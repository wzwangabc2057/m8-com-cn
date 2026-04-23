#!/usr/bin/env node
/**
 * 检查 Writing API job 的 files 结构，用于排查「无图」问题。
 * 用法: ARTICLE_WRITING_SYSTEM_API_TOKEN=xxx node scripts/inspect-job-files.mjs <jobId>
 *
 * 会输出：
 * - job.result.files（来自 getJob）
 * - GET /jobs/{id}/files 的完整列表
 * - 封面图匹配结果（与 sync 逻辑一致）
 */

const WRITING_TOKEN =
  process.env.ARTICLE_WRITING_SYSTEM_API_TOKEN || process.env.ARTICLE_WRITING_API_KEY;
const WRITING_BASE = 'https://web-production-0084b.up.railway.app';
const jobId = process.argv[2];

if (!WRITING_TOKEN || !jobId) {
  console.error('用法: ARTICLE_WRITING_SYSTEM_API_TOKEN=xxx node scripts/inspect-job-files.mjs <jobId>');
  process.exit(1);
}

const headers = { 'X-API-Key': WRITING_TOKEN, Accept: 'application/json' };

async function getJob(id) {
  const res = await fetch(`${WRITING_BASE}/api/v1/jobs/${encodeURIComponent(id)}`, { headers });
  if (!res.ok) throw new Error(`getJob: ${res.status}`);
  return res.json();
}

async function getJobFiles(id) {
  const res = await fetch(`${WRITING_BASE}/api/v1/jobs/${encodeURIComponent(id)}/files`, {
    headers,
  });
  if (!res.ok) throw new Error(`getJobFiles: ${res.status}`);
  return res.json();
}

async function main() {
  console.log(`\n=== Job ${jobId} ===\n`);

  const job = await getJob(jobId);
  console.log('Status:', job.status);
  console.log('Completed:', job.completed_at || '-');

  const resultFiles = job.result?.files || [];
  console.log('\n--- job.result.files (from getJob) ---');
  if (resultFiles.length === 0) {
    console.log('  (空)');
  } else {
    resultFiles.forEach((f) => console.log(`  ${f.name}  type=${f.type || '-'}  size=${f.size ?? '-'}`));
  }

  const filesResp = await getJobFiles(jobId);
  const listFiles = filesResp.files || [];
  console.log('\n--- GET /jobs/{id}/files ---');
  if (listFiles.length === 0) {
    console.log('  (空)');
  } else {
    listFiles.forEach((f) => console.log(`  ${f.name}  type=${f.type || '-'}  size=${f.size ?? '-'}`));
  }

  // 使用与 sync 相同的匹配逻辑
  const imageExts = /\.(webp|png|jpg|jpeg|gif)$/i;
  const isImageInImages = (f) =>
    f.name.includes('images/') &&
    (f.type?.startsWith?.('image/') || imageExts.test(f.name));
  const files = listFiles.length > 0 ? listFiles : resultFiles;
  const coverStrict = files.find(
    (f) =>
      isImageInImages(f) &&
      (f.name.includes('header') || f.name.includes('cover') || f.name.includes('featured'))
  );
  const coverFallback = files.find(isImageInImages);

  console.log('\n--- 封面图匹配 (sync 逻辑) ---');
  console.log('  严格匹配 (header/cover/featured):', coverStrict ? coverStrict.name : '(无)');
  console.log('  宽松回退 (images/ 下任意图):', coverFallback ? coverFallback.name : '(无)');
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
