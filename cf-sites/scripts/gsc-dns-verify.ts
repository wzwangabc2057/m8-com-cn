#!/usr/bin/env npx tsx
/**
 * Add Google Search Console DNS verification TXT record to Cloudflare for each site.
 * Use after adding a property in GSC: copy the TXT value (e.g. google-site-verification=xxx)
 * and run this script so verification can succeed.
 *
 * Usage:
 *   export CF_API_TOKEN=your_token
 *   export GSC_VERIFICATION_TXT="google-site-verification=xxxxxxxx"
 *   npx tsx scripts/gsc-dns-verify.ts
 *
 * Load CF token from cms/.dev.vars then run:
 *   (cd cms && set -a && source .dev.vars && set +a) && export GSC_VERIFICATION_TXT="google-site-verification=xxx" && npx tsx scripts/gsc-dns-verify.ts
 *
 * Domains are read from scripts/gsc-users-urls.txt (or migrate/sites dir).
 * TXT is added at zone apex (e.g. example.com) so one record verifies the whole zone.
 */

const CF_API = 'https://api.cloudflare.com/client/v4';

function getDomainsFromGscUrlsFile(): string[] {
  const fs = require('fs');
  const path = require('path');
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
  const fs = require('fs');
  const path = require('path');
  const sitesDir = path.join(__dirname, '../migrate/sites');
  if (!fs.existsSync(sitesDir)) return [];
  return fs.readdirSync(sitesDir, { withFileTypes: true })
    .filter((d: { isDirectory: () => boolean }) => d.isDirectory())
    .map((d: { name: string }) => d.name.toLowerCase())
    .sort();
}

async function findZone(token: string, hostname: string): Promise<{ id: string; name: string } | null> {
  const parts = hostname.replace(/^www\./, '').split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.');
    const res = await fetch(`${CF_API}/zones?name=${encodeURIComponent(candidate)}&status=active`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as { success: boolean; result: { id: string; name: string }[] };
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
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = (await res.json()) as { success: boolean; result: { id: string; type: string; name: string; content: string }[] };
  return data.success ? data.result : [];
}

async function createTxtRecord(
  token: string,
  zoneId: string,
  name: string,
  content: string
): Promise<boolean> {
  const res = await fetch(`${CF_API}/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'TXT',
      name,
      content,
      ttl: 1,
    }),
  });
  const data = (await res.json()) as { success: boolean; errors?: { message: string }[] };
  if (!data.success) {
    throw new Error(data.errors?.map((e) => e.message).join(', ') || 'Create TXT failed');
  }
  return true;
}

async function main() {
  const token = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  const verificationTxt = process.env.GSC_VERIFICATION_TXT;

  if (!token) {
    console.error('Need CF_API_TOKEN or CLOUDFLARE_API_TOKEN');
    process.exit(1);
  }
  if (!verificationTxt || verificationTxt.trim().length < 10) {
    console.error('Need GSC_VERIFICATION_TXT="google-site-verification=xxxx" (from GSC Add property → DNS verification)');
    process.exit(1);
  }
  const txtContent = verificationTxt.trim();

  let domains = getDomainsFromGscUrlsFile();
  if (domains.length === 0) domains = getDomainsFromSitesDir();
  if (domains.length === 0) {
    console.error('No domains found from gsc-users-urls.txt or migrate/sites');
    process.exit(1);
  }

  console.log('Domains to process:', domains.length);
  console.log('TXT content (first 50 chars):', txtContent.slice(0, 50) + (txtContent.length > 50 ? '...' : ''));
  console.log('');

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('--dry-run: no DNS changes will be made.\n');

  const zoneDone = new Set<string>();
  let added = 0;
  let skipped = 0;
  let noZone = 0;
  let errors = 0;

  for (const domain of domains) {
    const apex = domain.replace(/^www\./, '');
    if (zoneDone.has(apex)) {
      skipped++;
      continue;
    }
    const zone = await findZone(token, domain);
    if (!zone) {
      console.log(`  [no zone] ${domain}`);
      noZone++;
      continue;
    }
    zoneDone.add(zone.name);

    const existing = await listDnsRecords(token, zone.id, zone.name, 'TXT');
    const hasVerification = existing.some((r) =>
      r.content.includes('google-site-verification=')
    );
    if (hasVerification) {
      console.log(`  [skip] ${zone.name} (TXT verification already present)`);
      skipped++;
      continue;
    }

    try {
      if (!dryRun) {
        await createTxtRecord(token, zone.id, zone.name, txtContent);
      }
      console.log(`  [added] ${zone.name}${dryRun ? ' (dry-run)' : ''}`);
      added++;
    } catch (e) {
      console.error(`  [error] ${zone.name}:`, (e as Error).message);
      errors++;
    }
  }

  console.log('');
  console.log('Done. Added:', added, 'Skipped:', skipped, 'No zone:', noZone, 'Errors:', errors);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
