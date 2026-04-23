/**
 * Resolve siteId from request hostname via domain map stored in R2.
 * R2 key: _domain_map.json (global, not per-site)
 *
 * Format: { "blog-a.example.com": "site-a", "blog-b.example.com": "site-b" }
 *
 * Falls back to env.SITE_ID if domain map doesn't exist or hostname not found.
 */

// In-memory cache to avoid reading R2 on every request
let domainMapCache: Record<string, string> | null = null;
let domainMapCacheTime = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

export async function resolveSiteId(
  bucket: R2Bucket,
  hostname: string,
  fallbackSiteId: string,
): Promise<string> {
  const now = Date.now();

  // Refresh cache if expired
  if (!domainMapCache || now - domainMapCacheTime > CACHE_TTL_MS) {
    try {
      const obj = await bucket.get('_domain_map.json');
      if (obj) {
        domainMapCache = await obj.json<Record<string, string>>();
        domainMapCacheTime = now;
      } else {
        // No domain map exists — all requests use fallback
        domainMapCache = {};
        domainMapCacheTime = now;
      }
    } catch {
      // On error, use empty map
      domainMapCache = {};
      domainMapCacheTime = now;
    }
  }

  return domainMapCache[hostname] || fallbackSiteId;
}
