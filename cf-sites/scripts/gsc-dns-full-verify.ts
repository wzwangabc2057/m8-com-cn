#!/usr/bin/env npx tsx
/**
 * Full DNS verification flow:
 *   1. getToken(DNS_TXT) from Google Site Verification API per domain
 *   2. Add TXT record to Cloudflare DNS
 *   3. Call webResource.insert(DNS_TXT) to verify with Google
 *
 * Requires:
 *   GSC_SERVICE_ACCOUNT_JSON  or  GSC_SERVICE_ACCOUNT_JSON_PATH  (service account key)
 *   CF_API_TOKEN              (Cloudflare API token with DNS:Edit permission)
 *
 * Load from cms/.dev.vars:
 *   source cms/.dev.vars && export CF_API_TOKEN && export GSC_SERVICE_ACCOUNT_JSON_PATH=cms/config/xxx.json
 *   npx tsx scripts/gsc-dns-full-verify.ts [--dry-run] [--domain=zipip.co]
 */

import * as fs from 'fs';
import * as path from 'path';
import { getGscCredentials, getGscAccessToken } from '../cms/lib/gsc';

const SITE_VERIFICATION_SCOPE = 'https://www.googleapis.com/auth/siteverification';
const SITE_VERIFICATION_BASE = 'https://www.googleapis.com/siteVerification/v1';
const CF_API = 'https://api.cloudflare.com/client/v4';

// ─── Domain list ─────────────────────────────────────────

function getDomainsFromGscUrlsFile(): string[] {
  const p = path.join(__dirname, 'gsc-users-urls.txt');
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, 'utf8');
  const domains: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/resource_id=https%3A%2F%2F([^%/]+)/);
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

function apexDomain(domain: string): string {
  return domain.replace(/^www\./, '');
}

// ─── Google Site Verification API ────────────────────────

async function getDnsTxtToken(accessToken: string, domain: string): Promise<string> {
  const res = await fetch(`${SITE_VERIFICATION_BASE}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      site: { type: 'INET_DOMAIN', identifier: apexDomain(domain) },
      verificationMethod: 'DNS_TXT',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`getToken(DNS_TXT) failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error('getToken response missing token');
  return data.token; // e.g. "google-site-verification=XXXX"
}

async function verifyDns(accessToken: string, domain: string): Promise<void> {
  const res = await fetch(
    `${SITE_VERIFICATION_BASE}/webResource?verificationMethod=DNS_TXT`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        site: { type: 'INET_DOMAIN', identifier: apexDomain(domain) },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`verify(DNS_TXT) failed: ${res.status} ${err}`);
  }
}

// ─── Cloudflare DNS API ───────────────────────────────────

async function findZone(
  cfToken: string,
  domain: string
): Promise<{ id: string; name: string } | null> {
  const parts = apexDomain(domain).split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.');
    const res = await fetch(
      `${CF_API}/zones?name=${encodeURIComponent(candidate)}&status=active`,
      { headers: { Authorization: `Bearer ${cfToken}` } }
    );
    const data = (await res.json()) as {
      success: boolean;
      result: { id: string; name: string }[];
    };
    if (data.success && data.result.length > 0) return data.result[0];
  }
  return null;
}

async function listTxtRecords(
  cfToken: string,
  zoneId: string,
  zoneName: string
): Promise<{ id: string; content: string }[]> {
  const res = await fetch(
    `${CF_API}/zones/${zoneId}/dns_records?name=${encodeURIComponent(zoneName)}&type=TXT`,
    { headers: { Authorization: `Bearer ${cfToken}` } }
  );
  const data = (await res.json()) as {
    success: boolean;
    result: { id: string; type: string; name: string; content: string }[];
  };
  return data.success ? data.result : [];
}

async function addTxtRecord(
  cfToken: string,
  zoneId: string,
  zoneName: string,
  content: string
): Promise<void> {
  const res = await fetch(`${CF_API}/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'TXT', name: zoneName, content, ttl: 1 }),
  });
  const data = (await res.json()) as {
    success: boolean;
    errors?: { message: string }[];
  };
  if (!data.success) {
    throw new Error(
      data.errors?.map((e) => e.message).join(', ') || 'addTxtRecord failed'
    );
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  // Load GSC credentials
  let gscJson = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!gscJson && process.env.GSC_SERVICE_ACCOUNT_JSON_PATH) {
    const p = path.resolve(process.cwd(), process.env.GSC_SERVICE_ACCOUNT_JSON_PATH);
    if (fs.existsSync(p)) gscJson = fs.readFileSync(p, 'utf8');
  }

  const cfToken =
    process.env.CF_API_TOKEN ||
    process.env.CLOUDFLARE_API_TOKEN ||
    process.env.CF_ZONE_API_TOKEN;

  if (!gscJson) {
    console.error(
      'Need GSC_SERVICE_ACCOUNT_JSON or GSC_SERVICE_ACCOUNT_JSON_PATH'
    );
    process.exit(1);
  }
  if (!cfToken) {
    console.error('Need CF_API_TOKEN (Cloudflare token with DNS:Edit)');
    process.exit(1);
  }

  const creds = getGscCredentials({ GSC_SERVICE_ACCOUNT_JSON: gscJson });
  if (!creds) {
    console.error('Invalid GSC_SERVICE_ACCOUNT_JSON');
    process.exit(1);
  }

  const singleDomain = process.argv
    .find((a) => a.startsWith('--domain='))
    ?.slice(9);
  let domains: string[] = singleDomain
    ? [singleDomain]
    : getDomainsFromGscUrlsFile();
  if (domains.length === 0) domains = getDomainsFromSitesDir();
  if (domains.length === 0) {
    console.error('No domains found');
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('[dry-run] No actual changes.\n');

  console.log('Getting Google Site Verification access token...');
  const accessToken = await getGscAccessToken(creds, SITE_VERIFICATION_SCOPE);
  console.log(`Domains: ${domains.length}\n`);

  let ok = 0, skip = 0, noZone = 0, err = 0;

  for (const domain of domains) {
    const apex = apexDomain(domain);
    try {
      // 1. Get DNS TXT token from Google
      const txtToken = await getDnsTxtToken(accessToken, apex);
      console.log(`  [token] ${apex} → ${txtToken}`);

      if (dryRun) { ok++; continue; }

      // 2. Find Cloudflare zone
      const zone = await findZone(cfToken, apex);
      if (!zone) {
        console.log(`  [no-zone] ${apex} (not in Cloudflare)`);
        noZone++;
        continue;
      }

      // 3. Check if TXT already exists
      const existing = await listTxtRecords(cfToken, zone.id, zone.name);
      const alreadyHas = existing.some((r) =>
        r.content.includes('google-site-verification=')
      );
      if (alreadyHas) {
        console.log(`  [skip-dns] ${apex} (TXT already exists, verifying...)`);
      } else {
        await addTxtRecord(cfToken, zone.id, zone.name, txtToken);
        console.log(`  [dns-added] ${apex}`);
        // Brief wait for Cloudflare to propagate (usually instant)
        await sleep(1500);
      }

      // 4. Verify with Google
      await verifyDns(accessToken, apex);
      console.log(`  [verified ✓] ${apex}`);
      ok++;

    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('already been verified') || msg.includes('already verified')) {
        console.log(`  [already-verified] ${apex}`);
        skip++;
      } else {
        console.error(`  [error] ${apex}: ${msg}`);
        err++;
      }
    }
    await sleep(300);
  }

  console.log(`\nDone. Verified: ${ok}  Skipped: ${skip}  No-zone: ${noZone}  Errors: ${err}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
