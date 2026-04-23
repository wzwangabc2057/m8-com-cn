#!/usr/bin/env node
/**
 * 验证写作同步：检查 writing_sync 状态、写作 API jobs、CMS 文章
 * 用法: API_KEY=xxx ARTICLE_WRITING_SYSTEM_API_TOKEN=xxx node scripts/test-sync-verify.mjs
 */

const CMS_URL = process.env.CMS_URL || 'https://cloudflare-sites-cms.pages.dev';
const API_KEY = process.env.API_KEY;
const WRITING_TOKEN = process.env.ARTICLE_WRITING_SYSTEM_API_TOKEN;

if (!API_KEY || !WRITING_TOKEN) {
  console.error('需要: API_KEY, ARTICLE_WRITING_SYSTEM_API_TOKEN');
  process.exit(1);
}

const auth = { Authorization: `Bearer ${API_KEY}` };

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

async function listJobs(projectId) {
  const params = new URLSearchParams({ project_id: projectId, limit: '20' });
  const res = await fetch(
    `https://web-production-0084b.up.railway.app/api/v1/jobs?${params}`,
    { headers: { 'X-API-Key': WRITING_TOKEN, Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error(`jobs: ${res.status}`);
  return res.json();
}

async function getPosts(siteId) {
  const res = await fetch(`${CMS_URL}/api/posts?siteId=${encodeURIComponent(siteId)}`, { headers: auth });
  if (!res.ok) throw new Error(`posts: ${res.status}`);
  return res.json();
}

async function main() {
  console.log('=== 1. CMS 站点 ===');
  const sites = await getSites();
  const withDomain = sites.filter((s) => (s.url && s.url.trim()) || (s.domains && s.domains.length > 0));
  console.log(`共 ${sites.length} 个站点，${withDomain.length} 个有域名\n`);

  console.log('=== 2. writing_sync 状态 ===');
  for (const s of withDomain) {
    const sync = await getWritingSync(s.siteId);
    const status = sync.projectId ? `projectId=${sync.projectId} lastJobId=${sync.lastJobId || '(无)'}` : '未同步';
    console.log(`  ${s.siteId}: ${status}`);
  }

  console.log('\n=== 3. 写作 API jobs（每个已同步站点取最新 5 条）===');
  for (const s of withDomain) {
    const sync = await getWritingSync(s.siteId);
    if (!sync.projectId) continue;
    const { jobs } = await listJobs(sync.projectId);
    const recent = (jobs || []).slice(0, 5);
    console.log(`\n  ${s.siteId} (project=${sync.projectId}):`);
    if (recent.length === 0) {
      console.log('    (无 job)');
    } else {
      recent.forEach((j) => {
        console.log(`    - ${j.job_id} ${j.status} ${j.job_type} ${j.created_at?.slice(0, 19)}`);
      });
    }
  }

  console.log('\n=== 4. CMS 文章（草稿/已发布）===');
  for (const s of withDomain) {
    const posts = await getPosts(s.siteId);
    const list = posts.posts || posts || [];
    const drafts = list.filter((p) => p.status === 'draft');
    const published = list.filter((p) => p.status === 'published');
    console.log(`  ${s.siteId}: ${list.length} 篇 (草稿 ${drafts.length}, 已发布 ${published.length})`);
    if (drafts.length > 0) {
      drafts.slice(0, 3).forEach((p) => console.log(`    - [草稿] ${p.slug} ${p.title?.slice(0, 30)}`));
    }
  }

  console.log('\n=== 5. 再次触发同步 ===');
  const syncRes = await fetch(`${CMS_URL}/api/cron/sync-writing-tasks`, {
    method: 'POST',
    headers: { 'X-Cron-Secret': 'wr-sync-cron-5f8a2b1c', 'Content-Type': 'application/json' },
  });
  const summary = await syncRes.json();
  console.log(JSON.stringify(summary, null, 2));
  console.log('\n完成');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
