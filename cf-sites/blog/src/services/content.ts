import type {
  Post, PostSummary, PostIndexMeta, SiteConfig,
  PageEntry, PageRegistry, PageLayout,
} from '../types.js';
import { cachedGet, configKey, postKey, feedKey, pageKey } from './kv-cache.js';

/**
 * R2 key helpers — all keys are prefixed with sites/{siteId}/
 */
function prefix(siteId: string, path: string): string {
  return `sites/${siteId}/${path}`;
}

/**
 * Convert CMS proxy URLs to public URLs for published content.
 * /api/proxy?key=sites%2F{siteId}%2Fassets%2Fpath -> /site-assets/path
 */
function contentProxyToPublic(html: string, siteId: string): string {
  if (!html?.includes('/api/proxy')) return html;
  return html.replace(/\/api\/proxy\?key=([^"'\s&]+)/g, (_, encodedKey) => {
    try {
      const key = decodeURIComponent(encodedKey);
      const prefix = `sites/${siteId}/assets/`;
      if (key.startsWith(prefix)) {
        return `/site-assets/${key.slice(prefix.length)}`;
      }
    } catch (_) {}
    return `/api/proxy?key=${encodedKey}`;
  });
}

const DEFAULT_WIDTHS = [400, 800, 1200];
const DEFAULT_SIZES = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';

/**
 * Post-process content HTML to wrap image URLs with Cloudflare Image Resizing
 * and add srcset for responsive images. Runs at render time (outside cache).
 * Uses width attribute when present (e.g. width="80") to generate smaller srcset.
 */
export function applyImageResizing(html: string, enabled: boolean): string {
  if (!enabled || !html?.includes('<img')) return html;
  if (html.includes('/cdn-cgi/image/')) return html; // already processed

  return html.replace(/<img(\s+[^>]*?)>/gi, (match, attrs) => {
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) return match;
    const url = srcMatch[1].trim();
    if (url.startsWith('data:')) return match;
    if (url.includes('/cdn-cgi/image/')) return match;

    // Only transform /site-assets/ or full https URLs
    const isSiteAsset = url.startsWith('/site-assets/') || url.includes('/site-assets/');
    const isHttps = url.startsWith('https://');
    if (!isSiteAsset && !isHttps) return match;

    const path = url.startsWith('http') ? url : url.replace(/^\//, '');
    const buildCfUrl = (w: number) => `/cdn-cgi/image/width=${w},format=auto,quality=80/${path}`;

    // Use width attribute when present for smaller srcset (avatars, icons)
    const widthMatch = attrs.match(/\bwidth=["']?(\d+)["']?/i);
    const displayW = widthMatch ? parseInt(widthMatch[1], 10) : 0;
    const useFixedSize = displayW >= 1 && displayW <= 600;

    // Preserve existing sizes if present; otherwise use computed default
    const sizesMatch = attrs.match(/\bsizes=["']([^"']+)["']/i);
    const existingSizes = sizesMatch ? sizesMatch[1] : null;

    const widths = useFixedSize ? [displayW, displayW * 2] : DEFAULT_WIDTHS;
    const sizes = existingSizes || (useFixedSize ? `${displayW}px` : DEFAULT_SIZES);
    // Use 1x width for src (fallback): fixed-size uses displayW; default uses 800 (matches sizes)
    const srcW = useFixedSize ? displayW : 800;

    const newSrc = buildCfUrl(srcW);
    const srcset = widths.map((w) => `${buildCfUrl(w)} ${w}w`).join(', ');

    // Remove existing srcset/sizes to avoid duplicates
    let newAttrs = attrs.replace(/\ssrcset=["'][^"']*["']/gi, '').replace(/\ssizes=["'][^"']*["']/gi, '');
    newAttrs = newAttrs.replace(/src=["'][^"']*["']/i, `src="${newSrc}" srcset="${srcset}" sizes="${sizes}"`);
    return `<img${newAttrs}>`;
  });
}

// ─── Generic JSON read/write ───────────────────────────────

async function getJson<T>(bucket: R2Bucket, key: string, fallback: T): Promise<T> {
  const obj = await bucket.get(key);
  if (!obj) return fallback;
  return obj.json<T>();
}

async function putJson<T>(bucket: R2Bucket, key: string, data: T): Promise<void> {
  await bucket.put(key, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

// ─── Config ────────────────────────────────────────────────

export async function getConfig(bucket: R2Bucket, siteId: string, kv?: KVNamespace): Promise<SiteConfig> {
  return cachedGet(kv, configKey(siteId), async () => {
    const obj = await bucket.get(prefix(siteId, 'config.json'));
    if (!obj) throw new Error(`Site config not found for ${siteId}`);
    return obj.json<SiteConfig>();
  }, { ttl: 600 }); // 10 min TTL for config
}

export async function putConfig(bucket: R2Bucket, siteId: string, config: SiteConfig): Promise<void> {
  await putJson(bucket, prefix(siteId, 'config.json'), config);
}

// ─── Post Index Meta ───────────────────────────────────────

const SHARD_SIZE = 500;

export async function getPostIndexMeta(bucket: R2Bucket, siteId: string): Promise<PostIndexMeta> {
  return getJson<PostIndexMeta>(bucket, prefix(siteId, 'posts/_index.json'), {
    total: 0,
    shardSize: SHARD_SIZE,
    shardCount: 0,
    lastUpdated: new Date().toISOString(),
  });
}

export async function putPostIndexMeta(bucket: R2Bucket, siteId: string, meta: PostIndexMeta): Promise<void> {
  await putJson(bucket, prefix(siteId, 'posts/_index.json'), meta);
}

// ─── Post Shards ───────────────────────────────────────────

export async function getPostShard(bucket: R2Bucket, siteId: string, shardNum: number): Promise<PostSummary[]> {
  return getJson<PostSummary[]>(bucket, prefix(siteId, `posts/_shard-${shardNum}.json`), []);
}

export async function putPostShard(bucket: R2Bucket, siteId: string, shardNum: number, posts: PostSummary[]): Promise<void> {
  await putJson(bucket, prefix(siteId, `posts/_shard-${shardNum}.json`), posts);
}

/** Delete a shard file (for cleanup when shard count decreases) */
export async function deletePostShard(bucket: R2Bucket, siteId: string, shardNum: number): Promise<void> {
  await bucket.delete(prefix(siteId, `posts/_shard-${shardNum}.json`));
}

/** Load all shards into a single sorted array */
export async function loadAllShards(bucket: R2Bucket, siteId: string): Promise<PostSummary[]> {
  const meta = await getPostIndexMeta(bucket, siteId);
  if (meta.shardCount === 0) return [];

  const shards = await Promise.all(
    Array.from({ length: meta.shardCount }, (_, i) => getPostShard(bucket, siteId, i + 1)),
  );
  return shards.flat();
}

/** Write all posts as shards + update meta */
export async function writeShards(bucket: R2Bucket, siteId: string, allPosts: PostSummary[]): Promise<void> {
  const shardSize = SHARD_SIZE;
  const shardCount = Math.max(1, Math.ceil(allPosts.length / shardSize));

  // Get old shard count for cleanup
  const oldMeta = await getPostIndexMeta(bucket, siteId);
  const oldShardCount = oldMeta.shardCount;

  // Write shards in parallel
  const writes: Promise<void>[] = [];
  for (let i = 0; i < shardCount; i++) {
    const shard = allPosts.slice(i * shardSize, (i + 1) * shardSize);
    writes.push(putPostShard(bucket, siteId, i + 1, shard));
  }

  // Delete extra old shards if count decreased
  for (let i = shardCount + 1; i <= oldShardCount; i++) {
    writes.push(deletePostShard(bucket, siteId, i));
  }

  await Promise.all(writes);

  // Update meta
  await putPostIndexMeta(bucket, siteId, {
    total: allPosts.length,
    shardSize,
    shardCount,
    lastUpdated: new Date().toISOString(),
  });
}

// ─── Paginated Shard Read ──────────────────────────────────

/**
 * Get posts for a specific page by loading only needed shard(s).
 * Returns the sliced posts + total count.
 */
export async function getPostsFromShards(
  bucket: R2Bucket,
  siteId: string,
  page: number,
  pageSize: number,
): Promise<{ posts: PostSummary[]; total: number }> {
  const meta = await getPostIndexMeta(bucket, siteId);
  if (meta.total === 0 || meta.shardCount === 0) {
    return { posts: [], total: 0 };
  }

  const startIdx = (page - 1) * pageSize;
  const endIdx = startIdx + pageSize - 1;

  const startShard = Math.floor(startIdx / meta.shardSize) + 1;
  const endShard = Math.min(Math.floor(endIdx / meta.shardSize) + 1, meta.shardCount);

  // Load needed shards in parallel
  const shardNums = Array.from({ length: endShard - startShard + 1 }, (_, i) => startShard + i);
  const shards = await Promise.all(shardNums.map((n) => getPostShard(bucket, siteId, n)));

  // Combine and compute local offset
  const combined = shards.flat();
  const globalOffset = (startShard - 1) * meta.shardSize;
  const localStart = startIdx - globalOffset;
  const sliced = combined.slice(localStart, localStart + pageSize);

  return { posts: sliced, total: meta.total };
}

// ─── Single Post ───────────────────────────────────────────

export async function getPost(bucket: R2Bucket, siteId: string, slug: string, kv?: KVNamespace, sourceId?: string): Promise<Post | null> {
  return cachedGet(kv, postKey(siteId, slug), async () => {
    let obj = await bucket.get(prefix(siteId, `posts/${slug}.json`));
    if (!obj && sourceId) {
      obj = await bucket.get(prefix(sourceId, `posts/${slug}.json`));
    }
    if (!obj) return null;
    const post = await obj.json<Post>();
    post.content = contentProxyToPublic(post.content ?? '', siteId);
    return post;
  }, { ttl: 300 });
}

export async function putPost(bucket: R2Bucket, siteId: string, post: Post): Promise<void> {
  await putJson(bucket, prefix(siteId, `posts/${post.slug}.json`), post);
}

export async function deletePostFile(bucket: R2Bucket, siteId: string, slug: string): Promise<void> {
  await bucket.delete(prefix(siteId, `posts/${slug}.json`));
}

// ─── Feed Files ────────────────────────────────────────────

/**
 * Read a feed file: feeds/{type}/{slug}.json
 * Returns PostSummary[] sorted by publishedAt desc
 */
export async function getFeed(bucket: R2Bucket, siteId: string, feedPath: string, kv?: KVNamespace): Promise<PostSummary[]> {
  return cachedGet(kv, feedKey(siteId, feedPath), async () => {
    return getJson<PostSummary[]>(bucket, prefix(siteId, `feeds/${feedPath}.json`), []);
  }, { ttl: 300 });
}

export async function putFeed(bucket: R2Bucket, siteId: string, feedKey: string, posts: PostSummary[]): Promise<void> {
  await putJson(bucket, prefix(siteId, `feeds/${feedKey}.json`), posts);
}

export async function deleteFeed(bucket: R2Bucket, siteId: string, feedKey: string): Promise<void> {
  await bucket.delete(prefix(siteId, `feeds/${feedKey}.json`));
}

// ─── Pages (D1 only) ────────────────────────────────

/**
 * Get page registry for sitemap/nav from D1 (CMS pages, type='page', status='published').
 */
export async function getPageRegistry(bucket: R2Bucket, siteId: string, db: D1Database): Promise<PageRegistry> {
  const { results } = await db.prepare(
    `SELECT slug, title, excerpt, seo, layout, showTitle, showHeader, showFooter, containerClass FROM posts WHERE siteId = ? AND type = 'page' AND status = 'published'`
  )
    .bind(siteId)
    .all<{ slug: string; title: string; excerpt?: string; seo?: string; layout?: string; showTitle?: number; showHeader?: number; showFooter?: number; containerClass?: string }>();
  const registry: PageRegistry = {};
  for (const row of results) {
    let seoDescription: string | undefined;
    let noindex = false;
    if (row.seo) {
      try {
        const seo = JSON.parse(row.seo) as { description?: string; noindex?: boolean };
        seoDescription = seo.description;
        noindex = !!seo.noindex;
      } catch {
        /* ignore */
      }
    }
    registry[row.slug] = {
      title: row.title,
      description: seoDescription || row.excerpt,
      layout: row.layout as PageLayout | undefined,
      showTitle: row.showTitle !== 0,
      showHeader: row.showHeader !== 0,
      showFooter: row.showFooter !== 0,
      containerClass: row.containerClass ?? undefined,
      noindex,
    };
  }
  return registry;
}

export async function getPage(db: D1Database, bucket: R2Bucket, siteId: string, slug: string, sourceId?: string): Promise<PageEntry | null> {
  const meta = await db.prepare('SELECT * FROM posts WHERE siteId = ? AND slug = ? AND type = ?')
    .bind(siteId, slug, 'page')
    .first<PostSummary>();

  if (meta) {
    let postObj = await bucket.get(prefix(siteId, `posts/${slug}.json`));
    
    if (!postObj) {
      postObj = await bucket.get(prefix(siteId, `pages/${slug}.json`));
    }

    // Fallback to contentSourceId R2 folder (after site rename)
    if (!postObj && sourceId) {
      postObj = await bucket.get(prefix(sourceId, `posts/${slug}.json`));
      if (!postObj) {
        postObj = await bucket.get(prefix(sourceId, `pages/${slug}.json`));
      }
    }

    let post: Post;
    let content = '';

    if (postObj) {
      post = await postObj.json<Post>();
      content = post.content;
    } else {
      let htmlObj = await bucket.get(prefix(siteId, `pages/${slug}.html`));
      if (!htmlObj && sourceId) {
        htmlObj = await bucket.get(prefix(sourceId, `pages/${slug}.html`));
      }
      if (!htmlObj) return null;
      
      content = await htmlObj.text();
      post = {
        title: meta.title,
        excerpt: meta.excerpt || '',
        coverImage: meta.coverImage,
        content,
      } as Post;
    }

    // Parse seo: D1 stores JSON string; R2 post may have object from pages/*.json
    let seoObj: { title?: string; description?: string; noindex?: boolean } | undefined;
    if (post.seo && typeof post.seo === 'object') {
      seoObj = post.seo;
    } else if (meta.seo) {
      try {
        seoObj = typeof meta.seo === 'string' ? JSON.parse(meta.seo) : meta.seo;
      } catch {
        seoObj = undefined;
      }
    }

    return {
      title: post.title || meta.title,
      description: post.excerpt || meta.excerpt || '',
      content: contentProxyToPublic(content, siteId),
      layout: meta.layout || 'default',
      template: undefined,
      showTitle: meta.showTitle ?? true,
      showHeader: meta.showHeader ?? true,
      showFooter: meta.showFooter ?? true,
      containerClass: meta.containerClass,
      parent: undefined,
      order: 0,
      featuredImage: meta.coverImage,
      noindex: seoObj?.noindex ?? false,
      seo: seoObj,
      customCss: (meta as any).customCss || undefined,
      customJs: (meta as any).customJs || undefined,
      custom: undefined,
    };
  }

  return null;
}

export async function getKnownPageSlugs(db: D1Database, siteId: string): Promise<string[]> {
  // Get from D1
  const { results } = await db.prepare('SELECT slug FROM posts WHERE siteId = ? AND type = ?')
    .bind(siteId, 'page')
    .all<{ slug: string }>();
  
  return results.map(r => r.slug);
}

// ─── Custom Partials ───────────────────────────────────────

export async function getCustomPartial(bucket: R2Bucket, siteId: string, name: string, sourceId?: string): Promise<string | null> {
  let obj = await bucket.get(prefix(siteId, `partials/${name}.html`));
  if (!obj && sourceId) {
    obj = await bucket.get(prefix(sourceId, `partials/${name}.html`));
  }
  if (!obj) return null;
  return obj.text();
}

// ─── Helpers ───────────────────────────────────────────────

/** Convert a Post to PostSummary (strip content) */
export function postToSummary(post: Post): PostSummary {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    coverImage: post.coverImage,
    author: post.author,
    categories: post.categories,
    tags: post.tags,
    collection: post.collection,
    publishedAt: post.publishedAt,
  };
}
