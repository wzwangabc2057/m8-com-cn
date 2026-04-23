#!/usr/bin/env node
/**
 * 按白名单设置各站点的 writingSyncEnabled：
 * - 白名单内站点：writingSyncEnabled = true
 * - 其它站点：writingSyncEnabled = false
 *
 * 用法: API_KEY=xxx node scripts/set-writing-sync-by-whitelist.mjs [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CMS_URL = process.env.CMS_API_URL || process.env.CMS_URL || 'https://cloudflare-sites-cms.pages.dev';
const API_KEY = process.env.API_KEY || process.env.CMS_API_KEY;

const dryRun = process.argv.includes('--dry-run');

if (!API_KEY) {
  console.error('需要: API_KEY 或 CMS_API_KEY');
  process.exit(1);
}

const auth = { Authorization: `Bearer ${API_KEY}` };

function parseHost(urlOrDomain) {
  if (!urlOrDomain?.trim()) return null;
  try {
    const u = urlOrDomain.startsWith('http') ? urlOrDomain : `https://${urlOrDomain}`;
    return new URL(u).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function loadWhitelist() {
  const p = path.join(__dirname, '../daily-topic-finder/config/domain-whitelist.json');
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const data = JSON.parse(raw);
    const domains = (data.domains ?? []).map((d) => d.toLowerCase().trim()).filter(Boolean);
    const siteIds = (data.siteIds ?? []).map((s) => s.trim()).filter(Boolean);
    return { domains: new Set(domains), siteIds: new Set(siteIds) };
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.warn('白名单文件不存在:', p);
      return { domains: new Set(), siteIds: new Set() };
    }
    throw e;
  }
}

function isInWhitelist(site, whitelist) {
  if (whitelist.siteIds.has(site.siteId)) return true;
  const fromUrl = parseHost(site.url ?? '');
  if (fromUrl && whitelist.domains.has(fromUrl)) return true;
  for (const d of site.domains ?? []) {
    const host = parseHost(d);
    if (host && whitelist.domains.has(host)) return true;
  }
  return false;
}

async function getSites() {
  const res = await fetch(`${CMS_URL.replace(/\/$/, '')}/api/sites`, { headers: auth });
  if (!res.ok) throw new Error(`sites: ${res.status}`);
  const d = await res.json();
  return (d.sites || []).filter((s) => !s.disabled);
}

async function putConfig(siteId, patch) {
  const res = await fetch(`${CMS_URL.replace(/\/$/, '')}/api/config?siteId=${encodeURIComponent(siteId)}`, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`PUT config: ${res.status}`);
  return res.json();
}

async function main() {
  console.log(dryRun ? '=== [DRY RUN] 按白名单设置 writingSyncEnabled ===\n' : '=== 按白名单设置 writingSyncEnabled ===\n');

  const whitelist = loadWhitelist();
  console.log('白名单 domains:', [...whitelist.domains]);
  console.log('白名单 siteIds:', [...whitelist.siteIds]);
  console.log('');

  const sites = await getSites();
  const inWhitelist = sites.filter((s) => isInWhitelist(s, whitelist));
  const notInWhitelist = sites.filter((s) => !isInWhitelist(s, whitelist));

  console.log(`白名单内: ${inWhitelist.length} 个 → writingSyncEnabled = true`);
  inWhitelist.forEach((s) => console.log(`  ${s.siteId}`));
  console.log('');
  console.log(`白名单外: ${notInWhitelist.length} 个 → writingSyncEnabled = false`);
  notInWhitelist.forEach((s) => console.log(`  ${s.siteId}`));
  console.log('');

  if (dryRun) {
    console.log('[DRY RUN] 未写入');
    return;
  }

  let ok = 0;
  let err = 0;
  for (const s of inWhitelist) {
    try {
      await putConfig(s.siteId, { writingSyncEnabled: true });
      console.log(`  ✓ ${s.siteId} → true`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${s.siteId}: ${e.message}`);
      err++;
    }
  }
  for (const s of notInWhitelist) {
    try {
      await putConfig(s.siteId, { writingSyncEnabled: false });
      console.log(`  ✓ ${s.siteId} → false`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${s.siteId}: ${e.message}`);
      err++;
    }
  }

  console.log(`\n完成: ${ok} 成功, ${err} 失败`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
