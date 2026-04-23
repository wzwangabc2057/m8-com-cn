import { headers } from 'next/headers';
import { getEnv } from './cloudflare';
import { fetchStoreConfig, getDefaultStoreConfigContext, getLookupFromHeaders } from './store-config';

export type { StoreConfig, StoreConfigContext } from './store-config';

export async function getStoreConfigContext() {
  try {
    const env = getEnv();
    const requestHeaders = await headers();
    const lookup = getLookupFromHeaders(requestHeaders, env.SITE_ID);
    return fetchStoreConfig(env, lookup);
  } catch {
    return getDefaultStoreConfigContext();
  }
}

export async function getStoreConfig() {
  const context = await getStoreConfigContext();
  return context.config;
}
