/**
 * Cache invalidation helper.
 * Sends events to the storefront queue to invalidate KV cache keys
 * when content is created, updated, or deleted in the CMS.
 */

interface CacheInvalidateEvent {
  type: 'cache-invalidate';
  keys: string[];
}

/**
 * Invalidate cache keys via the storefront events queue.
 * Fails silently if EVENTS_QUEUE is not bound.
 */
export async function invalidateCache(queue: Queue | undefined, keys: string[]): Promise<void> {
  if (!queue || keys.length === 0) return;

  try {
    const event: CacheInvalidateEvent = {
      type: 'cache-invalidate',
      keys,
    };
    await queue.send(event);
  } catch (err) {
    console.error('Cache invalidation failed:', err);
    // Non-blocking: CMS should not fail if cache invalidation fails
  }
}

/**
 * Generate cache keys to invalidate when a post is created/updated/deleted.
 */
export function postCacheKeys(siteId: string, slug: string): string[] {
  return [
    `site:${siteId}:post:${slug}`,       // Individual post cache
    `site:${siteId}:posts:*`,             // All post listing pages
    `site:${siteId}:feed:*`,              // All feed caches
    `site:${siteId}:config`,              // Config (may show post counts)
  ];
}

/**
 * Generate cache keys to invalidate when site config is updated.
 */
export function configCacheKeys(siteId: string): string[] {
  return [
    `site:${siteId}:config`,
  ];
}

/**
 * Generate cache keys to invalidate when a page is created/updated/deleted.
 */
export function pageCacheKeys(siteId: string, slug: string): string[] {
  return [
    `site:${siteId}:page:${slug}`,
  ];
}

/**
 * Generate cache keys to invalidate when a custom partial is updated.
 */
export function partialCacheKeys(siteId: string, name: string): string[] {
  return [
    `site:${siteId}:partial:${name}`,
  ];
}
