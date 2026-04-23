#!/usr/bin/env node
/**
 * 下载 job 的 md 文件并检查是否含图片引用
 * 用法: node scripts/fetch-job-md.mjs <jobId>
 */
import 'dotenv/config';

const token = process.env.ARTICLE_WRITING_SYSTEM_API_TOKEN || process.env.ARTICLE_WRITING_API_KEY;
const jobId = process.argv[2];
if (!token || !jobId) {
  console.error('用法: node scripts/fetch-job-md.mjs <jobId>');
  process.exit(1);
}

const BASE = 'https://web-production-0084b.up.railway.app';
const headers = { 'X-API-Key': token, Accept: 'application/json' };

// 先获取文件列表，找到 md 文件
const filesRes = await fetch(`${BASE}/api/v1/jobs/${jobId}/files`, { headers });
if (!filesRes.ok) throw new Error(`files: ${filesRes.status}`);
const { files } = await filesRes.json();
const mdFile = files?.find((f) => f.name.endsWith('.md'));
if (!mdFile) {
  console.log('无 md 文件');
  process.exit(0);
}

const pathEnc = mdFile.name.split('/').map(encodeURIComponent).join('/');
const mdRes = await fetch(`${BASE}/api/v1/jobs/${jobId}/files/${pathEnc}`, { headers });
if (!mdRes.ok) throw new Error(`download: ${mdRes.status}`);
const md = await mdRes.text();

// 检查图片引用
const imgMarkdown = md.match(/!\[[^\]]*\]\([^)]+\)/g);
const imgHtml = md.match(/<img[^>]+src=["'][^"']+["']/gi);
const imgPath = md.match(/\/images\/[^\s"')\]]+/g);
const anyImg = md.match(/(?:!\[.*?\]\(|src=["']|href=["'])[^"')]*(?:\.webp|\.png|\.jpg|\.jpeg|\.gif)/gi);

console.log('=== MD 中的图片引用 ===\n');
console.log('Markdown 语法 ![](url):', imgMarkdown?.length ?? 0);
if (imgMarkdown?.length) imgMarkdown.forEach((m) => console.log('  ', m.slice(0, 80) + (m.length > 80 ? '...' : '')));
console.log('\nHTML <img src>:', imgHtml?.length ?? 0);
if (imgHtml?.length) imgHtml.forEach((m) => console.log('  ', m.slice(0, 100) + (m.length > 100 ? '...' : '')));
console.log('\n路径含 /images/:', imgPath?.length ?? 0);
if (imgPath?.length) imgPath.forEach((p) => console.log('  ', p));
console.log('\n任意图片扩展名:', anyImg?.length ?? 0);
if (anyImg?.length) anyImg.forEach((a) => console.log('  ', a.slice(0, 100)));

// 输出 md 前 100 行（看结构）
console.log('\n--- MD 前 50 行 ---');
console.log(md.split('\n').slice(0, 50).join('\n'));
