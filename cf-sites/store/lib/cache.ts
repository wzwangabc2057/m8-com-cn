/**
 * KV Read-Through Cache for the Store service.
 * Mirrors the blog's kv-cache.ts pattern for consistency.
 */

interface CacheOptions {
  ttl?: number;
}

export async function cachedGet<T>(
  kv: KVNamespace,
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const { ttl = 300 } = options;

  try {
    const cached = await kv.get(key, 'json');
    if (cached !== null) {
      console.log(`[Cache] HIT for ${key}`);
      return cached as T;
    }
  } catch (err) {
    console.error(`[Cache] GET error for ${key}:`, err);
    // Fall through to fetcher
  }

  console.log(`[Cache] MISS for ${key}, fetching fresh data...`);
  const fresh = await fetcher();

  try {
    await kv.put(key, JSON.stringify(fresh), { expirationTtl: ttl });
    console.log(`[Cache] WROTE fresh data for ${key}`);
  } catch (err) {
    console.error(`[Cache] PUT error for ${key}:`, err);
    // Non-blocking cache write failure
  }

  return fresh;
}

export async function invalidate(kv: KVNamespace, key: string): Promise<void> {
  try {
    await kv.delete(key);
  } catch {
    // Ignore
  }
}

function normalizeScope(value: string): string {
  return value.replace(/[^a-z0-9:._-]/gi, '_');
}

// Cache key builders for store data
export const cacheKeys = {
  config: (scope: string) => `store:config:${normalizeScope(scope)}`,
  products: (scope: string, page: number) => `store:${normalizeScope(scope)}:products:v2:p${page}`,
  product: (scope: string, handle: string) => `store:${normalizeScope(scope)}:product:${handle}`,
  collections: () => `store:collections`,
  collection: (handle: string) => `store:collection:${handle}`,
  regions: () => `store:regions`,
};
