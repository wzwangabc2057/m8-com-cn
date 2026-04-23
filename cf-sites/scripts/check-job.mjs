#!/usr/bin/env node
/**
 * 查询指定 project 的 job 详情及 after 的 jobs
 * 用法: ARTICLE_WRITING_SYSTEM_API_TOKEN=xxx node scripts/check-job.mjs <projectId> [lastJobId]
 */

const WRITING_TOKEN = process.env.ARTICLE_WRITING_SYSTEM_API_TOKEN || process.env.ARTICLE_WRITING_API_KEY;
const WRITING_BASE = 'https://web-production-0084b.up.railway.app';

const projectId = process.argv[2] || 'site_33_1768844586458';
const lastJobId = process.argv[3] || 'job_3489a6a0590f';

if (!WRITING_TOKEN) {
  console.error('需要: ARTICLE_WRITING_SYSTEM_API_TOKEN 或 ARTICLE_WRITING_API_KEY');
  process.exit(1);
}

const headers = { 'X-API-Key': WRITING_TOKEN, Accept: 'application/json' };

async function getJob(jobId) {
  const res = await fetch(`${WRITING_BASE}/api/v1/jobs/${encodeURIComponent(jobId)}`, { headers });
  if (!res.ok) return null;
  return res.json();
}

async function listJobs(projectId, opts = {}) {
  const params = new URLSearchParams({ project_id: projectId, limit: '100', order: 'asc' });
  if (opts.after) params.set('after', opts.after);
  const res = await fetch(`${WRITING_BASE}/api/v1/jobs?${params}`, { headers });
  if (!res.ok) throw new Error(`jobs: ${res.status}`);
  return res.json();
}

async function main() {
  console.log(`Project: ${projectId}\nLast Job ID: ${lastJobId}\n`);

  const jobDetail = await getJob(lastJobId);
  if (jobDetail) {
    console.log('=== lastJobId 详情 ===');
    console.log(`  job_id: ${jobDetail.job_id}`);
    console.log(`  status: ${jobDetail.status}`);
    console.log(`  job_type: ${jobDetail.job_type}`);
    console.log(`  created_at: ${jobDetail.created_at}`);
    console.log(`  completed_at: ${jobDetail.completed_at || '-'}`);
    if (jobDetail.error) console.log(`  error: ${jobDetail.error}`);
    console.log('');
  } else {
    console.log(`job ${lastJobId} 不存在或不属于此 project\n`);
  }

  const { jobs, total, has_more } = await listJobs(projectId, { after: lastJobId });
  console.log('=== after lastJobId 的 jobs ===');
  console.log(`  total: ${total}  has_more: ${has_more}`);
  console.log(`  本页: ${jobs?.length || 0} 条\n`);

  const allRes = await listJobs(projectId, { limit: 5, order: 'desc' });
  console.log('=== project 最新 5 条 jobs (order desc) ===');
  (allRes.jobs || []).forEach((j) => {
    console.log(`  ${j.job_id}  ${j.status}  ${j.created_at?.slice(0, 19)}`);
  });
  console.log('');

  if (jobs?.length) {
    const byStatus = {};
    for (const j of jobs) {
      byStatus[j.status] = (byStatus[j.status] || 0) + 1;
    }
    console.log('  状态分布:', byStatus);
    console.log('\n  前 20 条:');
    jobs.slice(0, 20).forEach((j) => {
      console.log(`    ${j.job_id}  ${j.status}  ${j.created_at?.slice(0, 19)}`);
    });
  } else {
    console.log('  (无更多 job，lastJobId 已是最后一条)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
