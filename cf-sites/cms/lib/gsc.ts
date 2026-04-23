/**
 * Google Search Console API (service account).
 * Requires env GSC_SERVICE_ACCOUNT_JSON (stringified JSON of the key file).
 */

const WEBMASTERS_READ_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const WEBMASTERS_WRITE_SCOPE = 'https://www.googleapis.com/auth/webmasters';
const WEBMASTERS_BASE = 'https://www.googleapis.com/webmasters/v3';

export interface GscCredentials {
  client_email: string;
  private_key: string;
  token_uri: string;
}

export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscSearchAnalyticsResponse {
  responseAggregationType?: string;
  rows?: GscRow[];
}

function base64UrlEncode(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === 'string'
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binary = Uint8Array.from(
    atob(pemContents),
    (c) => c.charCodeAt(0),
  );
  return crypto.subtle.importKey(
    'pkcs8',
    binary,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function signJwt(
  payload: Record<string, unknown>,
  privateKeyPem: string,
  header: Record<string, string> = { alg: 'RS256', typ: 'JWT' },
): Promise<string> {
  const key = await importPrivateKey(privateKeyPem);
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const message = `${headerB64}.${payloadB64}`;

  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(message),
  );
  const sigB64 = base64UrlEncode(sig);
  return `${message}.${sigB64}`;
}

/**
 * Get credentials from env. Set GSC_SERVICE_ACCOUNT_JSON to the full JSON string of the key file.
 */
export function getGscCredentials(env: { GSC_SERVICE_ACCOUNT_JSON?: string }): GscCredentials | null {
  const raw = env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as {
      client_email?: string;
      private_key?: string;
      token_uri?: string;
    };
    if (!parsed.client_email || !parsed.private_key || !parsed.token_uri) return null;
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
      token_uri: parsed.token_uri,
    };
  } catch {
    return null;
  }
}

/**
 * Exchange service account credentials for an access token.
 * @param scope Use WEBMASTERS_WRITE_SCOPE for submitting sitemaps; default is read-only.
 */
export async function getGscAccessToken(
  creds: GscCredentials,
  scope: string = WEBMASTERS_READ_SCOPE,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJwt(
    {
      iss: creds.client_email,
      scope,
      aud: creds.token_uri,
      iat: now,
      exp: now + 3600,
    },
    creds.private_key,
  );

  const res = await fetch(creds.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GSC token error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('GSC token response missing access_token');
  return data.access_token;
}

/**
 * Normalize site URL for GSC API (URL-prefix property: https://example.com/).
 */
export function toGscSiteUrl(domainOrUrl: string): string {
  const s = domainOrUrl.trim().toLowerCase();
  if (s.startsWith('sc-domain:')) return s;
  if (s.startsWith('http://') || s.startsWith('https://')) {
    const url = new URL(s);
    return `${url.origin}/`;
  }
  return `https://${s}/`;
}

/**
 * Get display domain from GSC siteUrl (for UI: show 域名 instead of full URL/id).
 */
export function siteUrlToDisplayDomain(siteUrl: string): string {
  const s = siteUrl.trim();
  if (s.startsWith('sc-domain:')) return s.slice('sc-domain:'.length);
  try {
    const url = new URL(s.startsWith('http') ? s : `https://${s}`);
    return url.hostname;
  } catch {
    return siteUrl;
  }
}

/**
 * Query Search Console searchAnalytics for a site.
 */
export async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  options: { dimensions?: string[]; rowLimit?: number } = {},
): Promise<GscSearchAnalyticsResponse> {
  const url = `${WEBMASTERS_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const body: Record<string, unknown> = {
    startDate,
    endDate,
    rowLimit: options.rowLimit ?? 10,
  };
  if (options.dimensions?.length) body.dimensions = options.dimensions;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GSC searchAnalytics error: ${res.status} ${err}`);
  }

  return res.json() as Promise<GscSearchAnalyticsResponse>;
}

/** Scope required for submitting sitemaps (write). */
export const GSC_SCOPE_SITEMAP = WEBMASTERS_WRITE_SCOPE;

/**
 * Submit a sitemap URL to Google Search Console.
 * PUT /sites/{siteUrl}/sitemaps/{feedpath} where feedpath is the full sitemap URL.
 */
export async function submitSitemap(
  accessToken: string,
  siteUrl: string,
  sitemapFullUrl: string,
): Promise<void> {
  const url = `${WEBMASTERS_BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapFullUrl)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GSC sitemap submit error: ${res.status} ${err}`);
  }
}

/**
 * Delete a sitemap from Google Search Console.
 * DELETE /sites/{siteUrl}/sitemaps/{feedpath}
 */
export async function deleteSitemap(
  accessToken: string,
  siteUrl: string,
  sitemapFullUrl: string,
): Promise<void> {
  const url = `${WEBMASTERS_BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapFullUrl)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`GSC sitemap delete error: ${res.status} ${err}`);
  }
}

/**
 * List all sitemaps registered in GSC for a site.
 * GET /sites/{siteUrl}/sitemaps
 */
export async function listSitemaps(
  accessToken: string,
  siteUrl: string,
): Promise<Array<{ path: string; lastSubmitted?: string; isPending?: boolean; errors?: number; warnings?: number }>> {
  const url = `${WEBMASTERS_BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GSC list sitemaps error: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { sitemap?: Array<{ path: string; lastSubmitted?: string; isPending?: boolean; errors?: number; warnings?: number }> };
  return data.sitemap ?? [];
}
