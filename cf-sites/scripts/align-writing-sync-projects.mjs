#!/usr/bin/env node
/**
 * 对齐所有站点的 writing_sync projectId 与提交任务使用的 project 一致，
 * 不一致的更新并重置 Last Job ID。
 *
 * 用法: API_KEY=xxx ARTICLE_WRITING_SYSTEM_API_TOKEN=xxx node scripts/align-writing-sync-projects.mjs [--dry-run]
 */

const CMS_URL = process.env.CMS_API_URL || process.env.CMS_URL || 'https://cloudflare-sites-cms.pages.dev';
const API_KEY = process.env.API_KEY || process.env.CMS_API_KEY;
const WRITING_TOKEN = process.env.ARTICLE_WRITING_SYSTEM_API_TOKEN || process.env.ARTICLE_WRITING_API_KEY;

const dryRun = process.argv.includes('--dry-run');

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

async function listJobs(projectId, opts = {}) {
  const params = new URLSearchParams({ project_id: projectId, limit: '1' });
  if (opts.after) params.set('after', opts.after);
  const res = await fetch(`${WRITING_BASE}/api/v1/jobs?${params}`, { headers: WRITING_HEADERS });
  if (!res.ok) throw new Error(`jobs: ${res.status}`);
  return res.json();
}

async function getWritingSync(siteId) {
  const res = await fetch(`${CMS_URL.replace(/\/$/, '')}/api/writing-sync?siteId=${encodeURIComponent(siteId)}`, { headers: auth });
  if (!res.ok) throw new Error(`writing-sync: ${res.status}`);
  return res.json();
}

async function putWritingSync(siteId, projectId, lastJobId = null) {
  const res = await fetch(`${CMS_URL.replace(/\/$/, '')}/api/writing-sync`, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteId, projectId, lastJobId }),
  });
  if (!res.ok) throw new Error(`PUT writing-sync: ${res.status}`);
  return res.json();
}

/**
 * 与 ensureProject 逻辑一致：按 domain 查找 project，不创建。
 * 多个匹配时优先选有 jobs 的（避免空 project 如 site_33）。
 */
async function findExpectedProject(primaryDomain, projects, siteLanguage) {
  const domainLower = primaryDomain.toLowerCase();
  let matches = projects.filter((p) => p.domain && p.domain.toLowerCase() === domainLower);
  if (matches.length === 0) {
    const labels = primaryDomain.split('.').filter(Boolean);
    if (labels.length >= 2) {
      const rootDomain = labels.slice(-2).join('.');
      matches = projects.filter((p) => p.domain && p.domain.toLowerCase() === rootDomain.toLowerCase());
    }
  }
  if (matches.length === 0) {
    const projectIdFromDomain = primaryDomain.replace(/\./g, '-');
    const byId = projects.find((p) => p.id === projectIdFromDomain);
    if (byId) return byId.id;
    return null;
  }
  if (matches.length === 1) return matches[0].id;
  // 多个匹配：优先有 jobs 的
  const withCount = await Promise.all(
    matches.map(async (p) => {
      try {
        const r = await listJobs(p.id);
        return { id: p.id, total: r.total ?? 0 };
      } catch {
        return { id: p.id, total: 0 };
      }
    })
  );
  const best = withCount.sort((a, b) => b.total - a.total)[0];
  return best.id;
}

async function main() {
  console.log(dryRun ? '=== [DRY RUN] 对齐 writing_sync projectId ===\n' : '=== 对齐 writing_sync projectId ===\n');

  const [sites, projects] = await Promise.all([getSites(), listProjects()]);
  const withDomain = sites.filter((s) => {
    const domains = new Set();
    const fromUrl = parseHost(s.url || '');
    if (fromUrl) domains.add(fromUrl);
    for (const d of s.domains || []) domains.add(parseHost(d) || d);
    return domains.size > 0 || s.url || (s.domains && s.domains.length > 0);
  });

  console.log(`站点 ${sites.length} 个，有域名 ${withDomain.length} 个`);
  console.log(`Writing API projects: ${projects.length} 个\n`);

  const updates = [];
  for (const site of withDomain) {
    const primaryDomain = (site.domains?.[0] ? parseHost(site.domains[0]) : null) ?? parseHost(site.url ?? '') ?? site.siteId;
    if (!primaryDomain) continue;

    const expectedProjectId = await findExpectedProject(primaryDomain, projects, site.language);
    const current = await getWritingSync(site.siteId);

    if (!expectedProjectId) {
      console.log(`  ${site.siteId}: 无匹配 project (primaryDomain=${primaryDomain})，跳过`);
      continue;
    }

    const currentProjectId = current.projectId || null;
    const needsUpdate = currentProjectId !== expectedProjectId;

    if (needsUpdate) {
      console.log(`  ${site.siteId}: ${currentProjectId || '(无)'} → ${expectedProjectId} [需更新+重置 lastJobId]`);
      updates.push({ siteId: site.siteId, projectId: expectedProjectId });
    } else {
      console.log(`  ${site.siteId}: ${currentProjectId} ✓ 一致`);
    }
  }

  if (updates.length === 0) {
    console.log('\n无需更新');
    return;
  }

  console.log(`\n${dryRun ? '[DRY RUN] 将更新' : '正在更新'} ${updates.length} 个站点...`);

  for (const { siteId, projectId } of updates) {
    if (dryRun) {
      console.log(`  [dry-run] PUT ${siteId} projectId=${projectId} lastJobId=null`);
    } else {
      try {
        const result = await putWritingSync(siteId, projectId, null);
        console.log(`  ✓ ${siteId} → ${projectId}`);
      } catch (e) {
        console.error(`  ✗ ${siteId}: ${e.message}`);
      }
    }
  }

  console.log('\n完成');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
