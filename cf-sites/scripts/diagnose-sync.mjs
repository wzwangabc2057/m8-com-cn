#!/usr/bin/env node
/**
 * 诊断 visacorp.icu / aiball.world 文章同步问题
 * 用法: API_KEY=xxx ARTICLE_WRITING_SYSTEM_API_TOKEN=xxx node scripts/diagnose-sync.mjs [visacorp.icu] [aiball.world]
 * 不传参数则诊断这两个站点
 */

const CMS_URL = process.env.CMS_URL || 'https://cloudflare-sites-cms.pages.dev';
const API_KEY = process.env.API_KEY;
const WRITING_TOKEN = process.env.ARTICLE_WRITING_SYSTEM_API_TOKEN;

if (!API_KEY || !WRITING_TOKEN) {
  console.error('需要: API_KEY, ARTICLE_WRITING_SYSTEM_API_TOKEN');
  process.exit(1);
}

const auth = { Authorization: `Bearer ${API_KEY}` };
const WRITING_BASE = 'https://web-production-0084b.up.railway.app';

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['visacorp.icu', 'aiball.world'];

async function listProjects() {
  const res = await fetch(`${WRITING_BASE}/api/v1/projects`, {
    headers: { 'X-API-Key': WRITING_TOKEN, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`projects: ${res.status}`);
  const d = await res.json();
  return d.projects || [];
}

async function listJobs(projectId, opts = {}) {
  const params = new URLSearchParams({ project_id: projectId, limit: String(opts.limit || 50) });
  if (opts.after) params.set('after', opts.after);
  if (opts.order) params.set('order', opts.order);
  const res = await fetch(`${WRITING_BASE}/api/v1/jobs?${params}`, {
    headers: { 'X-API-Key': WRITING_TOKEN, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`jobs: ${res.status}`);
  return res.json();
}

async function getSites() {
  const res = await fetch(`${CMS_URL}/api/sites`, { headers: auth });
  if (!res.ok) throw new Error(`sites: ${res.status}`);
  const d = await res.json();
  return d.sites || [];
}

async function getWritingSync(siteId) {
  const res = await fetch(`${CMS_URL}/api/writing-sync?siteId=${encodeURIComponent(siteId)}`, { headers: auth });
  if (!res.ok) throw new Error(`writing-sync: ${res.status}`);
  return res.json();
}

async function getPosts(siteId) {
  const res = await fetch(`${CMS_URL}/api/posts?siteId=${encodeURIComponent(siteId)}`, { headers: auth });
  if (!res.ok) throw new Error(`posts: ${res.status}`);
  return res.json();
}

function parseDomain(url) {
  if (!url?.trim()) return null;
  try {
    const u = url.startsWith('http') ? url : `https://${url}`;
    return new URL(u).hostname;
  } catch {
    return null;
  }
}

async function main() {
  console.log('=== 1. Writing API 所有 projects（domain 用于匹配）===\n');
  const projects = await listProjects();
  const relevant = projects.filter((p) =>
    targets.some((t) => (p.domain || '').includes(t.replace('.', '')) || (p.id || '').includes(t.replace(/\./g, '-')))
  );
  for (const p of relevant.length ? relevant : projects.slice(0, 20)) {
    console.log(`  ${p.id}  domain=${p.domain || '(null)'}  lang=${p.language || ''}`);
  }

  console.log('\n=== 2. CMS 站点与 writing_sync 状态 ===\n');
  const sites = await getSites();
  for (const siteId of targets) {
    const site = sites.find((s) => s.siteId === siteId);
    if (!site) {
      console.log(`  ${siteId}: 站点不存在`);
      continue;
    }
    const domains = new Set();
    const fromUrl = parseDomain(site.url || '');
    if (fromUrl) domains.add(fromUrl);
    for (const d of site.domains || []) domains.add(d);
    const sync = await getWritingSync(siteId);
    const hasProject = projects.some((p) => domains.has(p.domain));
    const matchProject = projects.find((p) => domains.has(p.domain));

    console.log(`  ${siteId}:`);
    console.log(`    url: ${site.url || '(空)'}`);
    console.log(`    domains: [${[...domains].join(', ') || '(空)'}]`);
    console.log(`    writing_sync: projectId=${sync.projectId ?? 'null'}  lastJobId=${sync.lastJobId ?? '(无)'}`);
    console.log(`    能否匹配 project: ${hasProject ? '是 → ' + (matchProject?.id || '') : '否（domain 与 Writing API 不匹配）'}`);
    console.log('');
  }

  console.log('=== 3. aiball.world jobs 与 CMS 文章日期 ===\n');
  const aiballSync = await getWritingSync('aiball.world');
  if (aiballSync?.projectId) {
    const { jobs } = await listJobs(aiballSync.projectId, { limit: 30, order: 'desc' });
    const completed = (jobs || []).filter((j) => j.status === 'completed');
    const pending = (jobs || []).filter((j) => j.status === 'pending' || j.status === 'running');
    const failed = (jobs || []).filter((j) => j.status === 'failed');
    console.log(`  project: ${aiballSync.projectId}  lastJobId: ${aiballSync.lastJobId || '(无)'}`);
    console.log(`  最近 jobs: completed=${completed.length} pending/running=${pending.length} failed=${failed.length}`);
    if (completed.length > 0) {
      const latest = completed[0];
      console.log(`  最新 completed: ${latest.job_id}  ${latest.created_at?.slice(0, 10)}`);
    }
    if (pending.length > 0) {
      console.log(`  有 pending/running 会阻塞同步:`);
      pending.slice(0, 5).forEach((j) => console.log(`    - ${j.job_id} ${j.status} ${j.created_at?.slice(0, 10)}`));
    }
  } else {
    console.log('  aiball.world 无 projectId，无法拉取 jobs');
  }

  const aiballPosts = await getPosts('aiball.world');
  const list = aiballPosts.posts || aiballPosts || [];
  const withDate = list
    .filter((p) => p.publishedAt || p.updatedAt)
    .map((p) => ({ slug: p.slug, d: (p.publishedAt || p.updatedAt || '').slice(0, 10) }))
    .sort((a, b) => b.d.localeCompare(a.d));
  if (withDate.length > 0) {
    console.log(`\n  CMS 最新文章日期: ${withDate[0]?.d} (${withDate[0]?.slug})`);
    console.log(`  共 ${list.length} 篇`);
  }

  console.log('\n=== 4. visacorp.icu 若 projectId 为空，可手动设置 ===\n');
  const visacorpSync = await getWritingSync('visacorp.icu');
  if (!visacorpSync?.projectId) {
    const vcProject = projects.find((p) => (p.domain || '').includes('visacorp'));
    if (vcProject) {
      console.log(`  建议: PUT /api/writing-sync 设置 projectId=${vcProject.id}`);
      console.log(`  curl -X PUT "${CMS_URL}/api/writing-sync" -H "Authorization: Bearer \$API_KEY" -H "Content-Type: application/json" -d '{"siteId":"visacorp.icu","projectId":"${vcProject.id}"}'`);
    } else {
      console.log('  Writing API 中未找到 visacorp 相关 project，需先在写作系统创建');
    }
  } else {
    console.log(`  visacorp.icu 已有 projectId=${visacorpSync.projectId}`);
  }

  console.log('\n=== 5. aiball 若卡在 3/4，可重置 lastJobId 重跑 ===\n');
  console.log('  POST /api/cron/sync-writing-tasks?resetLastJobId=true');
  console.log('  (会从最早 job 重新处理，可能重复；或 rematch=true 重新匹配 project)');
  console.log('\n完成');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
