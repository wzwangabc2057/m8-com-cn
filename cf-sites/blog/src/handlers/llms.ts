import { getPageRegistry, getConfig } from '../services/content.js';
import { getPosts } from '../services/d1-content.js';
import { getAuthors } from '../services/meta.js';
import { buildGeoResearchIndex, buildLlmsText } from '../utils/geo.js';
import type { Env } from '../types.js';

export async function handleLlms(env: Env): Promise<Response> {
  const [config, authors, pageRegistry, postResult] = await Promise.all([
    getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE),
    getAuthors(env.CONTENT_BUCKET, env.SITE_ID),
    getPageRegistry(env.CONTENT_BUCKET, env.SITE_ID, env.DB),
    getPosts(env.DB, env.SITE_ID, 1, env.SITE_ID === 'm8.com.cn' ? 80 : 20),
  ]);

  const index = buildGeoResearchIndex({
    siteId: env.SITE_ID,
    config,
    authors,
    pageRegistry,
    posts: postResult.posts,
    effectiveOrigin: env.EFFECTIVE_ORIGIN,
  });

  return new Response(buildLlmsText(index), {
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
