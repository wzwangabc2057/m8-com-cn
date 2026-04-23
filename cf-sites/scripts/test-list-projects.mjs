#!/usr/bin/env node
/**
 * 本地测试：拉取写作 API 的 projects 列表
 * 用法: ARTICLE_WRITING_SYSTEM_API_TOKEN=xxx node scripts/test-list-projects.mjs
 */

const BASE = 'https://web-production-0084b.up.railway.app';
const API_KEY = process.env.ARTICLE_WRITING_SYSTEM_API_TOKEN;

if (!API_KEY) {
  console.error('请设置 ARTICLE_WRITING_SYSTEM_API_TOKEN');
  process.exit(1);
}

async function listProjects() {
  const res = await fetch(`${BASE}/api/v1/projects`, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`listProjects: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.projects ?? [];
}

async function main() {
  console.log('拉取 projects...\n');
  const projects = await listProjects();
  console.log(`共 ${projects.length} 个 project:\n`);
  projects.forEach((p, i) => {
    console.log(`${i + 1}. id=${p.id} domain=${p.domain || '(无)'} name=${p.name || p.id}`);
  });
  console.log('\n完成');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
