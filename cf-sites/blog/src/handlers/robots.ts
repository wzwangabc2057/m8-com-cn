import { getConfig } from '../services/content.js';
import type { Env } from '../types.js';

/**
 * Generate robots.txt dynamically. Sitemap URL uses effective request origin.
 */
export async function handleRobots(env: Env): Promise<Response> {
  const config = await getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE);
  const base = (env.EFFECTIVE_ORIGIN ?? '').replace(/\/$/, '');
  const sitemapUrl = base ? `${base}/sitemap.xml` : '/sitemap.xml';
  const llmsUrl = base ? `${base}/llms.txt` : '/llms.txt';
  const researchIndexUrl = base ? `${base}/research-index.json` : '/research-index.json';
  const lines = [
    '# Public pages and site assets are crawlable.',
    '# API routes remain blocked.',
    '',
    'User-agent: Googlebot',
    'Allow: /',
    'Allow: /site-assets/',
    'Disallow: /api/',
    '',
    'User-agent: GoogleOther',
    'Allow: /',
    'Allow: /site-assets/',
    'Disallow: /api/',
    '',
    'User-agent: Google-Extended',
    'Allow: /',
    'Allow: /site-assets/',
    'Disallow: /api/',
    '',
    'User-agent: OAI-SearchBot',
    'Allow: /',
    'Allow: /site-assets/',
    'Disallow: /api/',
    '',
    'User-agent: ChatGPT-User',
    'Allow: /',
    'Allow: /site-assets/',
    'Disallow: /api/',
    '',
    'User-agent: GPTBot',
    'Allow: /',
    'Allow: /site-assets/',
    'Disallow: /api/',
    '',
    'User-agent: ClaudeBot',
    'Allow: /',
    'Allow: /site-assets/',
    'Disallow: /api/',
    '',
    'User-agent: PerplexityBot',
    'Allow: /',
    'Allow: /site-assets/',
    'Disallow: /api/',
    '',
    'User-agent: CCBot',
    'Allow: /',
    'Allow: /site-assets/',
    'Disallow: /api/',
    '',
    'User-agent: *',
    'Allow: /',
    'Allow: /site-assets/',
    'Disallow: /api/',
    '',
    `# llms.txt: ${llmsUrl}`,
    `# research-index: ${researchIndexUrl}`,
    `Sitemap: ${sitemapUrl}`,
  ];

  if (config.seo?.robotsExtra) {
    for (const rawLine of config.seo.robotsExtra.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) {
        if (lines[lines.length - 1] !== '') lines.push('');
        continue;
      }
      const normalized = line.toLowerCase();
      if (normalized === 'disallow: /site-assets/' || normalized === 'disallow: /site-assets') continue;
      if (normalized.startsWith('sitemap:')) continue;
      lines.push(line);
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
