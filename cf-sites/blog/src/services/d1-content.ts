import type { Post, PostSummary, PaginationInfo } from '../types.js';

/**
 * Decode URL-encoded text (e.g. %E0%B8%81... from APIs) for display.
 * Safe: only decodes when string looks like percent-encoding; leaves others unchanged.
 */
function safeDecodeUri(s: string): string {
  if (!s || typeof s !== 'string') return s;
  try {
    if (!/%[0-9A-Fa-f]{2}/.test(s)) return s;
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export interface PostFilter {
  category?: string;
  tag?: string;
  author?: string;
  collection?: string;
  type?: string;
  status?: string;
}

/**
 * Get posts from D1 with optional filtering
 */
export async function getPosts(
  db: D1Database,
  siteId: string,
  page: number,
  pageSize: number,
  filter?: PostFilter
): Promise<{ posts: PostSummary[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const conditions: string[] = ['p.siteId = ?'];
  const params: unknown[] = [siteId];

  // Default filters if not specified
  if (!filter?.type) {
    conditions.push("p.type = 'post'");
  } else if (filter.type !== 'all') {
    conditions.push("p.type = ?");
    params.push(filter.type);
  }

  if (!filter?.status) {
    conditions.push("p.status = 'published'");
  } else if (filter.status !== 'all') {
    conditions.push("p.status = ?");
    params.push(filter.status);
  }

  // Join logic
  let joinClause = '';
  
  if (filter?.tag) {
    joinClause += ` JOIN post_taxonomies t_tag ON p.siteId = t_tag.siteId AND p.slug = t_tag.postSlug`;
    const tagDecoded = safeDecodeUri(filter.tag);
    const tagEncoded = (() => {
      try {
        const e = encodeURIComponent(tagDecoded);
        return e !== tagDecoded ? e : '';
      } catch {
        return '';
      }
    })();
    const tagEncodedLower = tagEncoded ? tagEncoded.toLowerCase() : '';
    const tagValues = [...new Set([filter.tag, tagDecoded, tagEncoded, tagEncodedLower].filter(Boolean))];
    const tagPlaceholders = tagValues.map(() => '?').join(', ');
    conditions.push(`t_tag.type = 'tag' AND t_tag.value IN (${tagPlaceholders})`);
    params.push(...tagValues);
  }

  if (filter?.category) {
    joinClause += ` JOIN post_taxonomies t_cat ON p.siteId = t_cat.siteId AND p.slug = t_cat.postSlug`;
    // Match decoded, encoded (upper/lower hex) — D1 may store any of these
    const catDecoded = safeDecodeUri(filter.category);
    const catEncoded = (() => {
      try {
        const e = encodeURIComponent(catDecoded);
        return e !== catDecoded ? e : '';
      } catch {
        return '';
      }
    })();
    const catEncodedLower = catEncoded ? catEncoded.toLowerCase() : '';
    const catValues = [...new Set([filter.category, catDecoded, catEncoded, catEncodedLower].filter(Boolean))];
    const placeholders = catValues.map(() => '?').join(', ');
    conditions.push(`t_cat.type = 'category' AND t_cat.value IN (${placeholders})`);
    params.push(...catValues);
  }

  if (filter?.author) {
    conditions.push("p.author = ?");
    params.push(filter.author);
  }

  if (filter?.collection) {
    conditions.push("p.collection = ?");
    params.push(filter.collection);
  }

  const whereClause = conditions.join(' AND ');

  // Query Total
  const countQuery = `
    SELECT COUNT(DISTINCT p.slug) as total 
    FROM posts p 
    ${joinClause}
    WHERE ${whereClause}
  `;
  
  // Query Posts
  // We need to group by p.slug if we join multiple times to avoid duplicates, 
  // but with simple filters distinct is enough or subqueries. 
  // For simplicity with this schema design, DISTINCT p.slug is safest if joins multiply rows.
  // Note: D1/SQLite basic queries:
  
  const postsQuery = `
    SELECT DISTINCT 
      p.slug, p.title, p.excerpt, p.coverImage, p.author, p.collection, p.publishedAt
    FROM posts p 
    ${joinClause}
    WHERE ${whereClause}
    ORDER BY p.publishedAt DESC
    LIMIT ? OFFSET ?
  `;

  const [countResult, postsResult] = await Promise.all([
    db.prepare(countQuery).bind(...params).first<{ total: number }>(),
    db.prepare(postsQuery).bind(...params, pageSize, offset).all<PostSummary>(),
  ]);

  const posts = postsResult.results || [];
  
  // Hydrate tags/categories. D1 limits to 100 bound params per query, so batch by 99 slugs.
  const D1_PARAM_LIMIT = 100;
  const SLUG_BATCH = D1_PARAM_LIMIT - 1; // 1 for siteId

  if (posts.length > 0) {
    const slugs = posts.map(p => p.slug);
    const taxMap = new Map<string, { tags: string[], categories: string[] }>();

    for (let i = 0; i < slugs.length; i += SLUG_BATCH) {
      const batch = slugs.slice(i, i + SLUG_BATCH);
      const placeholders = batch.map(() => '?').join(',');
      const taxQuery = `
        SELECT postSlug, type, value 
        FROM post_taxonomies 
        WHERE siteId = ? AND postSlug IN (${placeholders})
      `;
      const taxResult = await db.prepare(taxQuery).bind(siteId, ...batch).all<{ postSlug: string, type: string, value: string }>();
      for (const row of taxResult.results) {
        if (!taxMap.has(row.postSlug)) {
          taxMap.set(row.postSlug, { tags: [], categories: [] });
        }
        const entry = taxMap.get(row.postSlug)!;
        const decoded = safeDecodeUri(row.value);
        if (row.type === 'tag') entry.tags.push(decoded);
        if (row.type === 'category') entry.categories.push(decoded);
      }
    }

    for (const post of posts) {
      const entry = taxMap.get(post.slug) || { tags: [], categories: [] };
      post.tags = entry.tags;
      post.categories = entry.categories;
    }
  }

  return {
    posts: posts.map(p => ({
        ...p,
        title: safeDecodeUri(p.title),
        excerpt: safeDecodeUri(p.excerpt),
        tags: (p.tags || []).map(safeDecodeUri),
        categories: (p.categories || []).map(safeDecodeUri),
    })),
    total: countResult?.total || 0
  };
}

/**
 * Get a single post metadata from D1
 */
export async function getPostMeta(db: D1Database, siteId: string, slug: string): Promise<PostSummary | null> {
  const post = await db.prepare('SELECT * FROM posts WHERE siteId = ? AND slug = ?')
    .bind(siteId, slug)
    .first<PostSummary>();

  if (!post) return null;

  // Get taxonomies
  const taxResult = await db.prepare('SELECT type, value FROM post_taxonomies WHERE siteId = ? AND postSlug = ?')
    .bind(siteId, slug)
    .all<{ type: string, value: string }>();

  const tags: string[] = [];
  const categories: string[] = [];
  
  for (const row of taxResult.results) {
    const decoded = safeDecodeUri(row.value);
    if (row.type === 'tag') tags.push(decoded);
    if (row.type === 'category') categories.push(decoded);
  }

  return {
    ...post,
    title: safeDecodeUri(post.title),
    excerpt: safeDecodeUri(post.excerpt),
    tags,
    categories,
  };
}
