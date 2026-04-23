#!/usr/bin/env npx tsx
/**
 * Register unverified GSC sites: for each domain get a verification token from
 * Google Site Verification API, add TXT to Cloudflare DNS, then verify.
 *
 * Requires: CF_API_TOKEN, GSC_SERVICE_ACCOUNT_JSON (e.g. from cms/.dev.vars).
 * Run: source cms/.dev.vars 2>/dev/null; npx tsx scripts/gsc-register-sites.ts
 * Or:  ./scripts/gsc-register-sites.sh
 */

import * as fs from 'fs';
import * as path from 'path';
import { getGscCredentials, getGscAccessToken } from '../cms/lib/gsc';

const CF_API = 'https://api.cloudflare.com/client/v4';
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

async function findZone(
  token: string,
  hostname: string
): Promise<{ id: string; name: string } | null> {
  const parts = hostname.replace(/^www\./, '').split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.');
    const res = await fetch(
      `${CF_API}/zones?name=${encodeURIComponent(candidate)}&status=active`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = (await res.json()) as {
      success: boolean;
      result: { id: string; name: string }[];
    };
    if (data.success && data.result.length > 0) return data.result[0];
  }
  return null;
}

async function listDnsRecords(
  token: string,
  zoneId: string,
  name: string,
  type?: string
): Promise<{ id: string; type: string; name: string; content: string }[]> {
  const url = `${CF_API}/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}${type ? `&type=${type}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as {
    success: boolean;
    result: { id: string; type: string; name: string; content: string }[];
  };
  return data.success ? data.result : [];
}

async function createTxtRecord(
  token: string,
  zoneId: string,
  name: string,
  content: string
): Promise<void> {
  const res = await fetch(`${CF_API}/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'TXT', name, content, ttl: 1 }),
  });
  const data = (await res.json()) as {
    success: boolean;
    errors?: { message: string }[];
  };
  if (!data.success) {
    throw new Error(
      data.errors?.map((e) => e.message).join(', ') || 'Create TXT failed'
    );
  }
}

async function getVerificationToken(
  accessToken: string,
  domain: string
): Promise<string> {
  const res = await fetch(`${SITE_VERIFICATION_BASE}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      site: { type: 'INET_DOMAIN', identifier: domain },
      verificationMethod: 'DNS_TXT',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`getToken failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { method?: string; token?: string };
  if (!data.token) throw new Error('getToken response missing token');
  return data.token;
}

async function verifySite(
  accessToken: string,
  domain: string
): Promise<boolean> {
  const res = await fetch(
    `${SITE_VERIFICATION_BASE}/webResource?verificationMethod=DNS_TXT`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        site: { type: 'INET_DOMAIN', identifier: domain },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`verify failed: ${res.status} ${err}`);
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const cfToken =
    process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  const gscJson = process.env.GSC_SERVICE_ACCOUNT_JSON;

  if (!cfToken) {
    console.error('Need CF_API_TOKEN or CLOUDFLARE_API_TOKEN (e.g. from cms/.dev.vars)');
    process.exit(1);
  }
  if (!gscJson) {
    console.error(
      'Need GSC_SERVICE_ACCOUNT_JSON (full JSON string of service account key, e.g. in cms/.dev.vars)'
    );
    process.exit(1);
  }

  const creds = getGscCredentials({ GSC_SERVICE_ACCOUNT_JSON: gscJson });
  if (!creds) {
    console.error('Invalid GSC_SERVICE_ACCOUNT_JSON');
    process.exit(1);
  }

  let domains = getDomainsFromGscUrlsFile();
  if (domains.length === 0) domains = getDomainsFromSitesDir();
  if (domains.length === 0) {
    console.error('No domains from gsc-users-urls.txt or migrate/sites');
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('--dry-run: no DNS or verification changes.\n');

  console.log('Getting Site Verification API access token...');
  const accessToken = await getGscAccessToken(
    creds,
    SITE_VERIFICATION_SCOPE
  );
  console.log('Domains to process:', domains.length, '\n');

  const zoneDone = new Set<string>();
  let registered = 0;
  let skipped = 0;
  let noZone = 0;
  let errors = 0;

  for (const domain of domains) {
    const apex = domain.replace(/^www\./, '');
    if (zoneDone.has(apex)) {
      skipped++;
      continue;
    }

    const zone = await findZone(cfToken, domain);
    if (!zone) {
      console.log(`  [no zone] ${apex}`);
      noZone++;
      continue;
    }
    zoneDone.add(zone.name);

    try {
      const existing = await listDnsRecords(cfToken, zone.id, zone.name, 'TXT');
      const hasVerification = existing.some((r) =>
        r.content.includes('google-site-verification=')
      );

      let txtContent: string;
      if (hasVerification && !dryRun) {
        console.log(`  [skip] ${zone.name} (already has verification TXT)`);
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`  [dry-run] would register ${zone.name}`);
        registered++;
        continue;
      }

      txtContent = await getVerificationToken(accessToken, zone.name);
      const fullTxt = txtContent.startsWith('google-site-verification=')
        ? txtContent
        : `google-site-verification=${txtContent}`;

      await createTxtRecord(cfToken, zone.id, zone.name, fullTxt);
      await sleep(1500);
      await verifySite(accessToken, zone.name);
      console.log(`  [ok] ${zone.name}`);
      registered++;
      await sleep(500);
    } catch (e) {
      console.error(`  [error] ${zone.name}:`, (e as Error).message);
      errors++;
    }
  }

  console.log(
    '\nDone. Registered:',
    registered,
    'Skipped:',
    skipped,
    'No zone:',
    noZone,
    'Errors:',
    errors
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
