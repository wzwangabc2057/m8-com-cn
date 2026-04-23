import { resolveSiteId } from '../../src/services/site-resolver.js';
import type { Env } from '../../src/types.js';

/**
 * API middleware: resolves siteId from hostname before all API handlers.
 * Overrides env.SITE_ID so downstream handlers automatically use the correct site.
 *
 * Uses Object.defineProperty to override the frozen env object.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // Resolve siteId from hostname
  const siteId = await resolveSiteId(env.CONTENT_BUCKET, url.hostname, env.SITE_ID);

  // Override SITE_ID — try direct assignment first, then defineProperty for frozen objects
  try {
    (env as any).SITE_ID = siteId;
  } catch {
    try {
      Object.defineProperty(env, 'SITE_ID', { value: siteId, writable: true, configurable: true });
    } catch {
      // If both fail, store in data as fallback
      context.data.resolvedSiteId = siteId;
    }
  }

  return context.next();
};
