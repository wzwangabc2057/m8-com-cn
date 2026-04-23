import type { Env } from '../types.js';

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
};

/** Extensions that benefit from long immutable caching */
const IMMUTABLE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico',
  '.woff2', '.woff',
]);

/**
 * Serve per-site assets from R2: /site-assets/{path} -> sites/{siteId}/assets/{path}
 */
export async function handleSiteAsset(
  env: Env,
  assetPath: string,
  sourceId?: string,
): Promise<Response | null> {
  const key = `sites/${env.SITE_ID}/assets/${assetPath}`;
  let obj = await env.CONTENT_BUCKET.get(key);
  if (!obj && sourceId) {
    obj = await env.CONTENT_BUCKET.get(`sites/${sourceId}/assets/${assetPath}`);
  }
  if (!obj) return null;

  const ext = '.' + assetPath.split('.').pop()?.toLowerCase();
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

  // Long cache for images/fonts (immutable), shorter for CSS/JS (may change)
  // Optimization: Increased to 1 year for everything to satisfy Lighthouse.
  // Note: Updates to existing files might need cache purge or filename change.
  const cacheControl = 'public, max-age=31536000, immutable';

  return new Response(obj.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
