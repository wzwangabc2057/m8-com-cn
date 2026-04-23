#!/usr/bin/env node
/**
 * 下载 job 的 html 文件并检查是否含图片引用
 */
import 'dotenv/config';

const token = process.env.ARTICLE_WRITING_SYSTEM_API_TOKEN || process.env.ARTICLE_WRITING_API_KEY;
const jobId = process.argv[2];
if (!token || !jobId) {
  console.error('用法: node scripts/fetch-job-html.mjs <jobId>');
  process.exit(1);
}

const BASE = 'https://web-production-0084b.up.railway.app';
const headers = { 'X-API-Key': token };

const filesRes = await fetch(`${BASE}/api/v1/jobs/${jobId}/files`, {
  headers: { ...headers, Accept: 'application/json' },
});
const { files } = await filesRes.json();
const htmlFile = files?.find((f) => f.name.endsWith('.html'));
if (!htmlFile) {
  console.log('无 html 文件');
  process.exit(0);
}

const pathEnc = htmlFile.name.split('/').map(encodeURIComponent).join('/');
const htmlRes = await fetch(`${BASE}/api/v1/jobs/${jobId}/files/${pathEnc}`, { headers });
const html = await htmlRes.text();

const imgHtml = html.match(/<img[^>]+>/gi);
const imgSrc = html.match(/src=["'][^"']+["']/gi);
const imagesPath = html.match(/\/images\/[^"'\s>]+/g);

console.log('=== HTML 中的图片 ===\n');
console.log('<img> 标签数:', imgHtml?.length ?? 0);
if (imgHtml?.length) imgHtml.slice(0, 5).forEach((m) => console.log('  ', m));
console.log('\nsrc= 引用数:', imgSrc?.length ?? 0);
if (imgSrc?.length) imgSrc.slice(0, 10).forEach((s) => console.log('  ', s));
console.log('\n/images/ 路径数:', imagesPath?.length ?? 0);
if (imagesPath?.length) imagesPath.forEach((p) => console.log('  ', p));

console.log('\n--- HTML 前 80 行 ---');
console.log(html.split('\n').slice(0, 80).join('\n'));
