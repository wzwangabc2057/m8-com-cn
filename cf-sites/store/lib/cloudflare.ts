/**
 * Cloudflare bindings access for the Store service.
 * Uses @cloudflare/next-on-pages runtime to access Workers bindings.
 */

import { getRequestContext } from '@cloudflare/next-on-pages';

export interface StoreEnv {
  CACHE: KVNamespace;
  EVENTS_QUEUE: Queue;
  EDGE_SERVICES: Fetcher;
  ANALYTICS: AnalyticsEngineDataset;
  MEDUSA_BACKEND_URL: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  CMS_API_URL?: string; // URL to CMS API for settings
  /** When set, store config is fetched per-site (e.g. for publishable key). */
  SITE_ID?: string;
}

/**
 * Get Cloudflare environment bindings from the current request context.
 * Only available in Server Components and API routes.
 */
export function getEnv(): StoreEnv {
  if (process.env.NODE_ENV === 'development') {
    // In local development, we might not have bindings initialized yet depending on how Next is started
    try {
      const { env } = getRequestContext();
      if (env) return env as unknown as StoreEnv;
    } catch (e) {}

    // Fallback for local dev without bindings
    return {
      MEDUSA_BACKEND_URL: process.env.MEDUSA_BACKEND_URL || 'https://backend-production-eff2.up.railway.app',
      CMS_API_URL: process.env.CMS_API_URL,
      SITE_ID: process.env.SITE_ID,
    } as unknown as StoreEnv;
  }

  const { env } = getRequestContext();
  return env as unknown as StoreEnv;
}
