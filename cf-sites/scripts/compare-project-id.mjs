#!/usr/bin/env node
/**
 * 对比「写作提交脚本会用的 projectId」与「CMS writing_sync 的 projectId」
 *
 * 写作提交逻辑（daily-topic-finder）：
 *   1. primaryDomain = domains[0] ?? parseHost(url) ?? siteId
 *   2. ensureProject(primaryDomain, language) → 按 domain 精确匹配 / 根域 / id 查找
 *
 * 用法: API_KEY=xxx ARTICLE_WRITING_SYSTEM_API_TOKEN=xxx node scripts/compare-project-id.mjs [--json]
 */

const CMS_URL = process.env.CMS_API_URL || process.env.CMS_URL || 'https://cloudflare-sites-cms.pages.dev';
const API_KEY = process.env.API_KEY || process.env.CMS_API_KEY;
const WRITING_TOKEN = process.env.ARTICLE_WRITING_SYSTEM_API_TOKEN || process.env.ARTICLE_WRITING_API_KEY;

const jsonOut = process.argv.includes('--json');

if (!API_KEY || !WRITING_TOKEN) {
  console.error('需要: API_KEY (或 CMS_API_KEY), ARTICLE_WRITING_SYSTEM_API_TOKEN (或 ARTICLE_WRITING_API_KEY)');
  process.exit(1);
}

const auth = { Authorization: `Bearer ${API_KEY}` };
const WRITING_BASE = 'https://web-production-0084b.up.railway.app';
const WRITING_HEADERS = { 'X-API-Key': WRITING_TOKEN, Accept: 'application/json' };

function parseHost(urlOrDomain) {
  if (!urlOrDomain?.trim()) return null;
  try {
    const u = urlOrDomain.startsWith('http') ? urlOrDomain : `https://${urlOrDomain}`;
    return new URL(u).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** 与 loadSiteProfile 一致 */
function getPrimaryDomain(site) {
  return (site.domains?.[0] ? parseHost(site.domains[0]) : null) ?? parseHost(site.url ?? '') ?? site.siteId;
}

/** 与 ensureProject 一致（不创建） */
function findSubmitProjectId(primaryDomain, projects) {
  if (!primaryDomain) return null;
  const domainLower = primaryDomain.toLowerCase();
  let match = projects.find((p) => p.domain && p.domain.toLowerCase() === domainLower);
  if (!match && primaryDomain.includes('.')) {
    const parts = primaryDomain.split('.').filter(Boolean);
    if (parts.length >= 2) {
      const rootDomain = parts.slice(-2).join('.');
      match = projects.find((p) => p.domain && p.domain.toLowerCase() === rootDomain.toLowerCase());
    }
  }
  if (!match) {
    const idFromDomain = primaryDomain.replace(/\./g, '-');
    match = projects.find((p) => p.id === idFromDomain);
  }
  return match?.id ?? null;
}

async function getSites() {
  const res = await fetch(`${CMS_URL.replace(/\/$/, '')}/api/sites`, { headers: auth });
  if (!res.ok) throw new Error(`sites: ${res.status}`);
  const d = await res.json();
  return (d.sites || []).filter((s) => !s.disabled);
}

async function listProjects() {
  const res = await fetch(`${WRITING_BASE}/api/v1/projects`, { headers: WRITING_HEADERS });
  if (!res.ok) throw new Error(`projects: ${res.status}`);
  const d = await res.json();
  return d.projects || [];
}

async function getWritingSync(siteId) {
  const res = await fetch(`${CMS_URL.replace(/\/$/, '')}/api/writing-sync?siteId=${encodeURIComponent(siteId)}`, { headers: auth });
  if (!res.ok) throw new Error(`writing-sync: ${res.status}`);
  return res.json();
}

async function main() {
  const [sites, projects] = await Promise.all([getSites(), listProjects()]);

  const rows = [];
  for (const site of sites) {
    const primaryDomain = getPrimaryDomain(site);
    const submitProjectId = findSubmitProjectId(primaryDomain, projects);
    const cmsSync = await getWritingSync(site.siteId);
    const cmsProjectId = cmsSync.projectId ?? null;
    const match = submitProjectId === cmsProjectId;

    rows.push({
      siteId: site.siteId,
      primaryDomain: primaryDomain || '(无)',
      submitProjectId: submitProjectId ?? '(无匹配)',
      cmsProjectId: cmsProjectId ?? '(无)',
      match,
    });
  }

  if (jsonOut) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  console.log('=== 写作提交 projectId vs CMS writing_sync ===\n');
  console.log('primaryDomain: 写作脚本用 domains[0] ?? url ?? siteId');
  console.log('submitProjectId: ensureProject(primaryDomain) 会返回的 project');
  console.log('cmsProjectId: CMS writing_sync 当前值\n');

  const maxSite = Math.max(...rows.map((r) => r.siteId.length), 20);
  const maxSubmit = Math.max(...rows.map((r) => String(r.submitProjectId).length), 16);
  const maxCms = Math.max(...rows.map((r) => String(r.cmsProjectId).length), 14);

  console.log(
    `${'siteId'.padEnd(maxSite)} ${'primaryDomain'.padEnd(25)} ${'submitProjectId'.padEnd(maxSubmit)} ${'cmsProjectId'.padEnd(maxCms)} 一致`
  );
  console.log('-'.repeat(maxSite + maxSubmit + maxCms + 45));

  for (const r of rows) {
    const ok = r.match ? '✓' : '✗';
    console.log(
      `${r.siteId.padEnd(maxSite)} ${String(r.primaryDomain).padEnd(25)} ${String(r.submitProjectId).padEnd(maxSubmit)} ${String(r.cmsProjectId).padEnd(maxCms)} ${ok}`
    );
  }

  const mismatched = rows.filter((r) => !r.match);
  console.log(`\n不一致: ${mismatched.length} 个`);
  if (mismatched.length > 0) {
    console.log('可运行 node scripts/align-writing-sync-projects.mjs 自动对齐');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
