import { getConfig } from '../services/content.js';
import type { Env } from '../types.js';

/**
 * Generate robots.txt dynamically. Sitemap URL uses effective request origin.
 */
export async function handleRobots(env: Env): Promise<Response> {
  const config = await getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE);
  const base = (env.EFFECTIVE_ORIGIN ?? '').replace(/\/$/, '');
  const sitemapUrl = base ? `${base}/sitemap.xml` : '/sitemap.xml';

  let robots = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /site-assets/

Sitemap: ${sitemapUrl}
`;

  // Add custom robots rules if configured
  if (config.seo?.robotsExtra) {
    robots += `\n${config.seo.robotsExtra}\n`;
  }

  return new Response(robots, {
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
