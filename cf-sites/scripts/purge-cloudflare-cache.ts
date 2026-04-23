#!/usr/bin/env npx tsx
/**
 * Purge Cloudflare edge cache for a domain.
 * Use when 301 redirects or other responses are cached incorrectly.
 *
 * Usage: npx tsx scripts/purge-cloudflare-cache.ts [domain]
 *   domain defaults to aiball.world
 *
 * Loads CLOUDFLARE_API_TOKEN from project root .env or migrate/.env if not set.
 */

import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
}
const root = path.resolve(__dirname, '..');
if (!process.env.CLOUDFLARE_API_TOKEN && !process.env.CF_API_TOKEN) {
  loadEnvFile(path.join(root, '.env'));
  loadEnvFile(path.join(root, 'migrate', '.env'));
  loadEnvFile(path.join(root, 'cms', '.env.local'));
}
const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;

const CF_API = 'https://api.cloudflare.com/client/v4';

async function findZone(token: string, hostname: string): Promise<{ id: string; name: string } | null> {
  const parts = hostname.split('.');
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

async function purgeCache(token: string, zoneId: string, options: { files?: string[]; purge_everything?: boolean }) {
  const res = await fetch(`${CF_API}/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });
  const data = (await res.json()) as { success: boolean; errors?: { message: string }[] };
  if (!data.success) {
    throw new Error(data.errors?.map((e) => e.message).join(', ') || 'Purge failed');
  }
  return data;
}

async function main() {
  const domain = process.argv[2] || 'aiball.world';
  if (!token) {
    console.error('CLOUDFLARE_API_TOKEN or CF_API_TOKEN required (set in .env)');
    process.exit(1);
  }

  console.log(`Finding zone for ${domain}...`);
  const zone = await findZone(token, domain);
  if (!zone) {
    console.error(`Zone not found for ${domain}`);
    process.exit(1);
  }
  console.log(`Zone: ${zone.name} (${zone.id})`);

  console.log('Purging entire zone cache...');
  await purgeCache(token, zone.id, { purge_everything: true });
  console.log('Done. Cache purged.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
