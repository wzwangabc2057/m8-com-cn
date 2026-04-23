#!/usr/bin/env npx tsx
/**
 * Full flow: get HTML tag (META) verification token from Google → write to CMS config → verify.
 *
 * Requires:
 *   - GSC_SERVICE_ACCOUNT_JSON (for Google Site Verification API)
 *   - CMS_API_TOKEN (Bearer token for CMS API)
 *   - CMS_BASE_URL (default https://cloudflare-sites-cms.pages.dev)
 *
 * Run:
 *   export CMS_API_TOKEN=xxx
 *   (optional) export CMS_BASE_URL=https://...
 *   export GSC_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'   # or
 *   export GSC_SERVICE_ACCOUNT_JSON_PATH=/path/to/key.json
 *   npx tsx scripts/gsc-html-tag-verify.ts [--dry-run] [--domain=zipip.co]
 */

import * as fs from 'fs';
import * as path from 'path';
import { getGscCredentials, getGscAccessToken } from '../cms/lib/gsc';

const SITE_VERIFICATION_SCOPE = 'https://www.googleapis.com/auth/siteverification';
const SITE_VERIFICATION_BASE = 'https://www.googleapis.com/siteVerification/v1';

function getDomainsFromGscUrlsFile(): string[] {
  const p = path.join(__dirname, 'gsc-users-urls.txt');
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, 'utf8');
  const domains: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/resource_id=https%3A%2F%2F([^%\/]+)/);
    if (m) domains.push(m[1].toLowerCase());
  }
  return [...new Set(domains)];
}

function getDomainsFromSitesDir(): string[] {
  const sitesDir = path.join(__dirname, '../migrate/sites');
  if (!fs.existsSync(sitesDir)) return [];
  return fs
    .readdirSync(sitesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name.toLowerCase())
    .sort();
}

/** Domain to siteId: use tmp.{domain} for migrate-style sites. */
function domainToSiteId(domain: string): string {
  const d = domain.replace(/^www\./, '');
  return `tmp.${d}`;
}

/** Resolve siteId from CMS: GET /api/sites?domain=xxx. */
async function resolveSiteId(
  baseUrl: string,
  token: string,
  domain: string
): Promise<string | null> {
  const res = await fetch(
    `${baseUrl}/api/sites?domain=${encodeURIComponent(domain)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { siteId?: string };
  return data.siteId ?? null;
}

async function getMetaToken(
  accessToken: string,
  domain: string
): Promise<string> {
  const siteUrl = `https://${domain}/`;
  const res = await fetch(`${SITE_VERIFICATION_BASE}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      site: { type: 'SITE', identifier: siteUrl },
      verificationMethod: 'META',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`getToken(META) failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { method?: string; token?: string };
  if (!data.token) throw new Error('getToken response missing token');
  return data.token;
}

async function verifySiteMeta(
  accessToken: string,
  domain: string
): Promise<void> {
  const siteUrl = `https://${domain}/`;
  const res = await fetch(
    `${SITE_VERIFICATION_BASE}/webResource?verificationMethod=META`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        site: { type: 'SITE', identifier: siteUrl },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`verify(META) failed: ${res.status} ${err}`);
  }
}

async function getCmsConfig(
  baseUrl: string,
  token: string,
  siteId: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}/api/config?siteId=${encodeURIComponent(siteId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`GET config failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { config?: Record<string, unknown> };
  if (!data.config) throw new Error('GET config missing config');
  return data.config as Record<string, unknown>;
}

async function putCmsConfig(
  baseUrl: string,
  token: string,
  siteId: string,
  config: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/config?siteId=${encodeURIComponent(siteId)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    throw new Error(`PUT config failed: ${res.status} ${await res.text()}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const cmsToken = process.env.CMS_API_TOKEN;
  const cmsBase = (process.env.CMS_BASE_URL || 'https://cloudflare-sites-cms.pages.dev').replace(
    /\/$/,
    ''
  );
  let gscJson = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!gscJson && process.env.GSC_SERVICE_ACCOUNT_JSON_PATH) {
    const keyPath = path.resolve(process.cwd(), process.env.GSC_SERVICE_ACCOUNT_JSON_PATH);
    if (fs.existsSync(keyPath)) {
      gscJson = fs.readFileSync(keyPath, 'utf8');
    }
  }

  if (!cmsToken) {
    console.error('Need CMS_API_TOKEN');
    process.exit(1);
  }
  if (!gscJson) {
    console.error(
      'Need GSC_SERVICE_ACCOUNT_JSON or GSC_SERVICE_ACCOUNT_JSON_PATH (path to service account key JSON)'
    );
    process.exit(1);
  }

  const singleDomain = process.argv.find((a) => a.startsWith('--domain='))?.slice(9);
  let domains: string[] = singleDomain
    ? [singleDomain]
    : getDomainsFromGscUrlsFile();
  if (domains.length === 0) domains = getDomainsFromSitesDir();
  if (domains.length === 0) {
    console.error('No domains (use gsc-users-urls.txt, migrate/sites, or --domain=xxx)');
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('--dry-run: no CMS or Google changes.\n');

  const creds = getGscCredentials({ GSC_SERVICE_ACCOUNT_JSON: gscJson });
  if (!creds) {
    console.error('Invalid GSC_SERVICE_ACCOUNT_JSON');
    process.exit(1);
  }

  console.log('Getting Google Site Verification access token...');
  const accessToken = await getGscAccessToken(creds, SITE_VERIFICATION_SCOPE);
  console.log('CMS base:', cmsBase);
  console.log('Domains:', domains.length, '\n');

  let ok = 0;
  let skip = 0;
  let err = 0;

  for (const domain of domains) {
    let siteId = domainToSiteId(domain);
    try {
      if (dryRun) {
        const resolved = await resolveSiteId(cmsBase, cmsToken, domain);
        const sid = resolved ?? siteId;
        console.log(`  [dry-run] ${domain} -> siteId ${sid}`);
        ok++;
        continue;
      }

      const resolved = await resolveSiteId(cmsBase, cmsToken, domain);
      if (resolved) siteId = resolved;

      const metaToken = await getMetaToken(accessToken, domain);
      const config = await getCmsConfig(cmsBase, cmsToken, siteId);
      const seo = (config.seo as Record<string, unknown>) || {};
      config.seo = { ...seo, googleVerification: metaToken };
      await putCmsConfig(cmsBase, cmsToken, siteId, config);
      console.log(`  [config] ${domain} (${siteId})`);

      await sleep(2000);
      await verifySiteMeta(accessToken, domain);
      console.log(`  [ok] ${domain}`);
      ok++;
      await sleep(500);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('Site "${siteId}" not found') || msg.includes('404') || msg.includes('GET config failed: 404')) {
        console.log(`  [skip] ${domain} (no site ${siteId} in CMS)`);
        skip++;
      } else {
        console.error(`  [error] ${domain}:`, msg);
        err++;
      }
    }
  }

  console.log('\nDone. OK:', ok, 'Skipped:', skip, 'Errors:', err);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
