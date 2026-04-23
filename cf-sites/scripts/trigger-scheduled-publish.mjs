#!/usr/bin/env node
/**
 * 立即触发 scheduled-publish
 * 用法: node scripts/trigger-scheduled-publish.mjs
 * CRON_SECRET 与 trigger-sync 相同，从 cms/.dev.vars 或环境变量读取
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { resolve } from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

[resolve(process.cwd(), '.env'), resolve(process.cwd(), 'cron/.dev.vars'), resolve(process.cwd(), 'cms/.env.local'), resolve(process.cwd(), 'daily-topic-finder/.env')].forEach((p) => config({ path: p }));

const cmsUrl = (process.env.CMS_API_URL || process.env.CMS_URL || 'https://cloudflare-sites-cms.pages.dev').replace(/\/$/, '');
let secret = process.env.CRON_SECRET;
if (!secret) {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '../cms/.dev.vars'), 'utf-8');
    const m = raw.match(/CRON_SECRET=(.+)/m);
    if (m) secret = m[1].trim().replace(/^["']|["']$/g, '');
  } catch {}
}

if (!cmsUrl || !secret) {
  console.error('需要 CMS_API_URL（或 CMS_URL）和 CRON_SECRET');
  if (cmsUrl) console.error('  CMS 已配置:', cmsUrl);
  if (!secret) console.error('  请设置 CRON_SECRET（与 CMS 部署环境变量一致）');
  console.error('\n手动触发示例:');
  console.error(`  CRON_SECRET=你的密钥 node scripts/trigger-scheduled-publish.mjs`);
  console.error(`  或: curl "${cmsUrl || 'https://<cms>'}/api/cron/scheduled-publish" -H "X-Cron-Secret: <CRON_SECRET>"`);
  process.exit(1);
}

const url = `${cmsUrl}/api/cron/scheduled-publish`;
console.log('调用:', url);
const res = await fetch(url, {
  method: 'GET',
  headers: { 'X-Cron-Secret': secret },
});
const body = await res.text();
console.log('状态:', res.status);
console.log('响应:', body);
process.exit(res.ok ? 0 : 1);
