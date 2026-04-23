import type { Post, PostSummary, PostIndexMeta, SiteConfig } from '@/lib/types';

const SHARD_SIZE = 500;

function prefix(siteId: string, path: string): string {
  return `sites/${siteId}/${path}`;
}

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

// Config
export async function getConfig(bucket: R2Bucket, siteId: string): Promise<SiteConfig> {
  return getJson<SiteConfig>(bucket, prefix(siteId, 'config.json'), {} as SiteConfig);
}

export async function putConfig(bucket: R2Bucket, siteId: string, config: SiteConfig): Promise<void> {
  await putJson(bucket, prefix(siteId, 'config.json'), config);
}

// Posts
export async function getPostIndexMeta(bucket: R2Bucket, siteId: string): Promise<PostIndexMeta> {
  return getJson<PostIndexMeta>(bucket, prefix(siteId, 'posts/_index.json'), {
    total: 0,
    shardSize: SHARD_SIZE,
    shardCount: 0,
    lastUpdated: new Date().toISOString(),
  });
}

export async function getPostShard(bucket: R2Bucket, siteId: string, shardNum: number): Promise<PostSummary[]> {
  return getJson<PostSummary[]>(bucket, prefix(siteId, `posts/_shard-${shardNum}.json`), []);
}

export async function getAllPosts(bucket: R2Bucket, siteId: string): Promise<PostSummary[]> {
  const meta = await getPostIndexMeta(bucket, siteId);
  if (meta.shardCount === 0) return [];
  
  const shards = await Promise.all(
    Array.from({ length: meta.shardCount }, (_, i) => getPostShard(bucket, siteId, i + 1)),
  );
  return shards.flat();
}

export async function getPost(bucket: R2Bucket, siteId: string, slug: string): Promise<Post | null> {
  // 1. Try Standard Post (posts/*.json)
  const post = await getJson<Post | null>(bucket, prefix(siteId, `posts/${slug}.json`), null);
  if (post) return post;

  // 2. Try Standard Page (pages/*.json)
  const page = await getJson<Post | null>(bucket, prefix(siteId, `pages/${slug}.json`), null);
  if (page) {
    if (!page.type) page.type = 'page';
    return page;
  }

  // 3. Try Legacy HTML Page (pages/*.html)
  const htmlObj = await bucket.get(prefix(siteId, `pages/${slug}.html`));
  if (htmlObj) {
    const htmlContent = await htmlObj.text();
    return {
      slug,
      title: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' '), // Guess title from slug
      content: htmlContent,
      type: 'page',
      status: 'published',
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      excerpt: '',
      author: '',
      categories: [],
      tags: [],
      collection: ''
    };
  }

  return null;
}

export async function savePost(bucket: R2Bucket, siteId: string, post: Post): Promise<void> {
  // Only save the individual post file to R2.
  // Indexing is now handled by D1.
  await putJson(bucket, prefix(siteId, `posts/${post.slug}.json`), post);
}

export async function deletePost(bucket: R2Bucket, siteId: string, slug: string): Promise<void> {
  // Only delete the post file.
  await bucket.delete(prefix(siteId, `posts/${slug}.json`));
}

/**
 * Scan all individual post files in R2 (used for rebuilding D1 index).
 * Does NOT rely on index/shard files.
 */
interface R2Objects {
  objects: Array<{ key: string }>;
  truncated: boolean;
  cursor?: string;
}

export async function scanAllPostFiles(bucket: R2Bucket, siteId: string): Promise<Post[]> {
  const listPrefix = prefix(siteId, 'posts/');
  const posts: Post[] = [];
  
  let cursor: string | undefined;
  
  do {
    // Cast to any because types might be tricky with Next.js Edge runtime
    const listed: R2Objects = await bucket.list({ prefix: listPrefix, cursor });
    
    for (const obj of listed.objects) {
      const key = obj.key;
      // Extract filename from full key "sites/siteId/posts/filename.json"
      // listPrefix ends with "/" so we can just slice
      const filename = key.slice(listPrefix.length);
      
      // Skip files starting with _ (like _index.json, _shard-1.json)
      if (filename.startsWith('_')) continue;
      if (!filename.endsWith('.json')) continue;
      
      const data = await bucket.get(key);
      if (data) {
        try {
          const post = await data.json<Post>();
          if (post && post.slug && post.title) {
            // Ensure type matches folder convention if missing
            if (!post.type) post.type = 'post';
            posts.push(post);
          }
        } catch (e) {
          console.warn(`Failed to parse post: ${key}`, e);
        }
      }
    }
    
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  
  return posts;
}

/**
 * Scan all individual PAGE files in R2 (sites/siteId/pages/*.json).
 * Used for rebuilding D1 index when pages are stored in a separate folder.
 */
export async function scanAllPageFiles(bucket: R2Bucket, siteId: string): Promise<Post[]> {
  const listPrefix = prefix(siteId, 'pages/');
  const pages: Post[] = [];
  
  let cursor: string | undefined;
  
  do {
    const listed: R2Objects = await bucket.list({ prefix: listPrefix, cursor });
    
    for (const obj of listed.objects) {
      const key = obj.key;
      const filename = key.slice(listPrefix.length);
      
      if (filename.startsWith('_')) continue;
      if (!filename.endsWith('.json')) continue;
      
      const data = await bucket.get(key);
      if (data) {
        try {
          const page = await data.json<Post>();
          if (page && page.slug && page.title) {
            // Force type to page if loading from pages folder
            page.type = 'page';
            pages.push(page);
          }
        } catch (e) {
          console.warn(`Failed to parse page: ${key}`, e);
        }
      }
    }
    
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  
  return pages;
}

