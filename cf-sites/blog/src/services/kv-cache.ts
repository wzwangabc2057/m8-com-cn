/**
 * KV Read-Through Cache
 * 
 * Wraps any async fetcher with a Workers KV caching layer.
 * Falls back gracefully when KV is unavailable (returns fetcher result directly).
 */

export interface CacheOptions {
  /** TTL in seconds (default: 300 = 5 minutes) */
  ttl?: number;
  /** If true, return stale data while refreshing in background */
  staleWhileRevalidate?: boolean;
}

/**
 * Get data from KV cache or fetch from origin.
 * 
 * @param kv       - Workers KV namespace binding
 * @param key      - Cache key (e.g. "site:default:config")
 * @param fetcher  - Async function to get fresh data on cache miss
 * @param options  - Cache options (ttl, staleWhileRevalidate)
 */
export async function cachedGet<T>(
  kv: KVNamespace | undefined,
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const { ttl = 300 } = options;

  // If KV is not available, go direct to origin
  if (!kv) {
    return fetcher();
  }

  try {
    const cached = await kv.get(key, 'json');
    if (cached !== null) {
      return cached as T;
    }
  } catch {
    // KV read failed, fall through to fetcher
  }

  const fresh = await fetcher();

  // Write to cache in background (non-blocking)
  try {
    await kv.put(key, JSON.stringify(fresh), { expirationTtl: ttl });
  } catch {
    // KV write failed, data is still returned
  }

  return fresh;
}

/**
 * Invalidate a cache key.
 */
export async function invalidateCache(kv: KVNamespace | undefined, key: string): Promise<void> {
  if (!kv) return;
  try {
    await kv.delete(key);
  } catch {
    // Ignore deletion failures
  }
}

/**
 * Invalidate multiple cache keys matching a prefix pattern.
 * Note: KV list is eventually consistent, so this is best-effort.
 */
export async function invalidateCacheByPrefix(kv: KVNamespace | undefined, prefix: string): Promise<void> {
  if (!kv) return;
  try {
    const list = await kv.list({ prefix });
    const deletes = list.keys.map((k) => kv.delete(k.name));
    await Promise.all(deletes);
  } catch {
    // Ignore
  }
}

// ─── Cache Key Builders ──────────────────────────────────

export function configKey(siteId: string): string {
  return `site:${siteId}:config`;
}

export function postKey(siteId: string, slug: string): string {
  return `site:${siteId}:post:${slug}`;
}

export function postsPageKey(siteId: string, page: number, pageSize: number, filter?: string): string {
  const filterSuffix = filter ? `:${filter}` : '';
  return `site:${siteId}:posts:p${page}:s${pageSize}${filterSuffix}`;
}

export function feedKey(siteId: string, feedPath: string): string {
  return `site:${siteId}:feed:${feedPath}`;
}

export function pageKey(siteId: string, slug: string): string {
  return `site:${siteId}:page:${slug}`;
}

export function taxonomyKey(siteId: string, type: string, slug?: string): string {
  return slug ? `site:${siteId}:${type}:${slug}` : `site:${siteId}:${type}:all`;
}

/** Check if store/ecommerce is enabled (from shared KV cache). False when disabled or unknown. */
export async function getStoreEnabled(kv: KVNamespace | undefined): Promise<boolean> {
  if (!kv) return false;
  try {
    const cached = await kv.get('store:config:global', 'json') as { enabled?: boolean } | null;
    return cached?.enabled === true;
  } catch {
    return false;
  }
}
