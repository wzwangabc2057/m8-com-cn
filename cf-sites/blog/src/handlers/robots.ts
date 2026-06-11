import { getConfig } from '../services/content.js';
import type { Env } from '../types.js';

/**
 * Generate robots.txt dynamically. Sitemap URL uses effective request origin.
 */
export async function handleRobots(env: Env): Promise<Response> {
  const config = await getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE);
  const base = (env.EFFECTIVE_ORIGIN ?? '').replace(/\/$/, '');
  const sitemapUrl = base ? `${base}/sitemap.xml` : '/sitemap.xml';
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    `Sitemap: ${sitemapUrl}`,
  ];
  const seen = new Set<string>();
  const normalized = (line: string) => line.trim().toLowerCase();
  const pushLine = (line: string) => {
    if (!line.trim()) {
      if (lines[lines.length - 1] !== '') lines.push('');
      return;
    }
    const key = normalized(line);
    if (key === 'disallow: /site-assets/' || key === 'disallow: /site-assets') return;
    if (key.startsWith('sitemap:')) {
      const sitemapKey = `sitemap:${sitemapUrl.toLowerCase()}`;
      if (seen.has(sitemapKey)) return;
      seen.add(sitemapKey);
      lines.push(`Sitemap: ${sitemapUrl}`);
      return;
    }
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(line);
  };

  for (const line of lines.splice(0, lines.length)) {
    pushLine(line);
  }

  if (config.seo?.robotsExtra) {
    for (const line of config.seo.robotsExtra.split(/\r?\n/)) {
      pushLine(line.trim());
    }
  }

  const robots = `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;

  return new Response(robots, {
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
