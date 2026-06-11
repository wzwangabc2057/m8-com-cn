
import { getConfig } from '../services/content.js';
import { getPosts } from '../services/d1-content.js';
import { getAuthors } from '../services/meta.js';
import { buildCanonicalUrl, buildPostPath, getCanonicalBase } from '../utils/seo.js';
import type { Env } from '../types.js';

/**
 * Generate RSS 2.0 feed.xml dynamically.
 * Only loads latest 20 posts from D1.
 */
export async function handleFeed(env: Env): Promise<Response> {
  const [config, authors] = await Promise.all([
    getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE),
    getAuthors(env.CONTENT_BUCKET, env.SITE_ID),
  ]);

  const base = getCanonicalBase(config, env.EFFECTIVE_ORIGIN);

  // Get latest 20 posts from D1
  const { posts: latestPosts } = await getPosts(
    env.DB, env.SITE_ID, 1, 20
  );


  const items = latestPosts.map((post) => {
    const authorObj = authors.find((a) => a.id === post.author);
    const authorName = authorObj?.name || post.author;
    const postUrl = buildCanonicalUrl(base, buildPostPath(config.routes, post.slug));
    const coverImageUrl = post.coverImage
      ? (post.coverImage.startsWith('http://') || post.coverImage.startsWith('https://')
        ? post.coverImage
        : buildCanonicalUrl(base, post.coverImage))
      : null;
    const pubDate = new Date(post.publishedAt).toUTCString();
    const escapedTitle = escapeXml(post.title);
    const escapedExcerpt = escapeXml(post.excerpt);

    const categoryTags = post.categories.map(
      (cat) => `      <category>${escapeXml(cat)}</category>`,
    ).join('\n');
    const tagTags = post.tags.map(
      (tag) => `      <category>${escapeXml(tag)}</category>`,
    ).join('\n');

    return `    <item>
      <title>${escapedTitle}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <description>${escapedExcerpt}</description>
      <pubDate>${pubDate}</pubDate>
      <author>${escapeXml(authorName)}</author>
${categoryTags}
${tagTags}
      ${coverImageUrl ? `<enclosure url="${escapeXml(coverImageUrl)}" type="image/jpeg"/>` : ''}
    </item>`;
  }).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(config.name)}</title>
    <link>${escapeXml(buildCanonicalUrl(base, '/'))}</link>
    <description>${escapeXml(config.description)}</description>
    <language>${escapeXml(config.language)}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(buildCanonicalUrl(base, '/feed.xml'))}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml;charset=UTF-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
