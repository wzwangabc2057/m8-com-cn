/**
 * Medusa JS SDK client for the Store service.
 *
 * Connects to the Medusa backend at the configured URL.
 * When publishableKey (pk_...) is provided, requests are scoped to that key's sales channel(s).
 */

import Medusa from '@medusajs/js-sdk';

let _client: InstanceType<typeof Medusa> | null = null;
let _clientPublishableKey: string | undefined;

export function getMedusaClient(
  backendUrl?: string,
  publishableKey?: string
): InstanceType<typeof Medusa> {
  const baseUrl = backendUrl || process.env.MEDUSA_BACKEND_URL || 'https://backend-production-eff2.up.railway.app';
  // Use Medusa v2 format publishable key
  const key = publishableKey || process.env.MEDUSA_PUBLISHABLE_KEY || 'pk_01d4a0a4c5ce7c8ecbd52e0787ec34cd0e8b2bd4999ab56c121405eeb4e1cc51';

  if (_client && _clientPublishableKey === key) return _client;

  _client = new Medusa({
    baseUrl,
    publishableKey: key,
    debug: process.env.NODE_ENV === 'development',
  });
  _clientPublishableKey = key;
  return _client;
}

/**
 * Convenience: get a fresh Medusa client from Cloudflare env.
 */
export function medusaFromEnv(medusaUrl: string, publishableKey?: string): InstanceType<typeof Medusa> {
  const key = publishableKey || process.env.MEDUSA_PUBLISHABLE_KEY || 'pk_01d4a0a4c5ce7c8ecbd52e0787ec34cd0e8b2bd4999ab56c121405eeb4e1cc51';
  return new Medusa({
    baseUrl: medusaUrl,
    publishableKey: key,
    debug: false,
  });
}
