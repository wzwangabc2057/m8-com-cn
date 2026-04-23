#!/usr/bin/env node
/**
 * 手动触发 writing sync
 * 用法: CRON_SECRET=xxx node scripts/trigger-sync.mjs
 * 或从 cms/.dev.vars 读取（若存在）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let secret = process.env.CRON_SECRET;
if (!secret) {
  try {
    const p = path.join(__dirname, '../cms/.dev.vars');
    const raw = fs.readFileSync(p, 'utf-8');
    const m = raw.match(/CRON_SECRET=(.+)/m);
    if (m) secret = m[1].trim().replace(/^["']|["']$/g, '');
  } catch {}
}
if (!secret) {
  console.error('需要 CRON_SECRET（环境变量或 cms/.dev.vars）');
  process.exit(1);
}

const CMS_URL = process.env.CMS_URL || 'https://cloudflare-sites-cms.pages.dev';
const url = `${CMS_URL.replace(/\/$/, '')}/api/cron/sync-writing-tasks`;

async function main() {
  console.log('触发同步:', url);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-Cron-Secret': secret, 'Content-Type': 'application/json' },
  });
  const body = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', body);
  if (!res.ok) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
