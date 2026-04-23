#!/usr/bin/env node
/**
 * 设置 writing_sync 的 projectId
 * 用法: API_KEY=xxx node scripts/set-writing-sync-project.mjs <siteId> <projectId>
 * 或: CMS_API_KEY=xxx CMS_API_URL=xxx node scripts/set-writing-sync-project.mjs <siteId> <projectId>
 */

const CMS_URL = process.env.CMS_API_URL || process.env.CMS_URL || 'https://cloudflare-sites-cms.pages.dev';
const API_KEY = process.env.API_KEY || process.env.CMS_API_KEY;

const siteId = process.argv[2];
const projectId = process.argv[3];

if (!API_KEY) {
  console.error('需要: API_KEY 或 CMS_API_KEY');
  process.exit(1);
}
if (!siteId || !projectId) {
  console.error('用法: node scripts/set-writing-sync-project.mjs <siteId> <projectId>');
  process.exit(1);
}

async function main() {
  const res = await fetch(`${CMS_URL.replace(/\/$/, '')}/api/writing-sync`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ siteId, projectId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('失败:', res.status, data);
    process.exit(1);
  }
  console.log('成功:', data);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
