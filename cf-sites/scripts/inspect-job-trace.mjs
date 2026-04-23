#!/usr/bin/env node
/**
 * 检查 job trace，查看提交时的 input（含 options.enable_images）
 * 用法: node scripts/inspect-job-trace.mjs <jobId>
 */
import 'dotenv/config';
const token = process.env.ARTICLE_WRITING_SYSTEM_API_TOKEN || process.env.ARTICLE_WRITING_API_KEY;
const jobId = process.argv[2];
if (!token || !jobId) {
  console.error('用法: node scripts/inspect-job-trace.mjs <jobId>');
  process.exit(1);
}
const res = await fetch(
  `https://web-production-0084b.up.railway.app/api/v1/jobs/${jobId}/trace`,
  { headers: { 'X-API-Key': token, Accept: 'application/json' } }
);
if (!res.ok) {
  console.error('trace:', res.status, await res.text());
  process.exit(1);
}
const data = await res.json();
console.log('input.options:', JSON.stringify(data.input?.options, null, 2));
console.log('output.files:', data.output?.files?.length ?? 0, 'files');
if (data.output?.files?.length) {
  data.output.files.forEach((f) => console.log('  -', f));
}
