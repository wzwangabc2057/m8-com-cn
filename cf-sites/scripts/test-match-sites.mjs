#!/usr/bin/env node
/**
 * 本地测试：CMS 站点与写作 API projects 的域名匹配
 * 用法: API_KEY=xxx ARTICLE_WRITING_SYSTEM_API_TOKEN=xxx node scripts/test-match-sites.mjs [CMS_URL]
 */

const CMS_URL = process.env.CMS_URL || process.argv[2] || 'https://cloudflare-sites-cms.pages.dev';
const API_KEY = process.env.API_KEY;
const WRITING_TOKEN = process.env.ARTICLE_WRITING_SYSTEM_API_TOKEN;

if (!API_KEY || !WRITING_TOKEN) {
  console.error('需要: API_KEY, ARTICLE_WRITING_SYSTEM_API_TOKEN');
  process.exit(1);
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

const SITE_PROJECT_PATTERN = /^site_\d+_\d+$/;

function findProjectByDomain(projects, siteDomain, siteLanguage) {
  const matches = projects.filter((p) => p.domain && p.domain === siteDomain);
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];
  const siteFormat = matches.find((p) => SITE_PROJECT_PATTERN.test(p.id));
  if (siteFormat) return siteFormat;
  if (siteLanguage) {
    const langMatch = matches.find(
      (p) => p.language && p.language.toLowerCase() === siteLanguage.toLowerCase()
    );
    if (langMatch) return langMatch;
  }
  return matches[0];
}

async function getCmsSites() {
  const res = await fetch(`${CMS_URL}/api/sites`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`CMS sites: ${res.status}`);
  const data = await res.json();
  return data.sites ?? [];
}

async function getProjects() {
  const res = await fetch('https://web-production-0084b.up.railway.app/api/v1/projects', {
    headers: {
      'X-API-Key': WRITING_TOKEN,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Projects: ${res.status}`);
  const data = await res.json();
  return data.projects ?? [];
}

async function main() {
  console.log('1. 拉取 CMS 站点...');
  const sites = await getCmsSites();
  const sitesWithDomain = sites
    .map((s) => {
      const domains = new Set();
      const fromUrl = parseDomain(s.url);
      if (fromUrl) domains.add(fromUrl);
      for (const d of s.domains || []) domains.add(d);
      return { ...s, domains: [...domains], language: s.language };
    })
    .filter((s) => s.domains.length > 0);

  console.log(`   共 ${sites.length} 个站点，${sitesWithDomain.length} 个有域名\n`);

  console.log('2. 拉取写作 API projects...');
  const projects = await getProjects();
  console.log(`   共 ${projects.length} 个 project\n`);

  console.log('3. 匹配结果 (含 config.url + 绑定域名, 多 project 时按 language 优选):\n');
  console.log('   siteId                    | language | domains                    | 匹配 project (language)');
  console.log('   -------------------------|----------|----------------------------|---------------------------');

  const matched = [];
  const unmatched = [];
  for (const site of sitesWithDomain) {
    let match;
    for (const domain of site.domains) {
      match = findProjectByDomain(projects, domain, site.language);
      if (match) break;
    }
    const domainsStr = site.domains.join(', ');
    const status = match ? `✓ ${match.id} (${match.language || '-'})` : '✗ 无匹配';
    console.log(`   ${site.siteId.padEnd(25)} | ${(site.language || '-').padEnd(8)} | ${domainsStr.padEnd(26)} | ${status}`);
    if (match) matched.push(site);
    else unmatched.push(site);
  }

  console.log('\n--- 汇总 ---');
  console.log(`匹配: ${matched.length} 个`);
  console.log(`未匹配: ${unmatched.length} 个`);
  if (unmatched.length > 0) {
    console.log('\n未匹配的站点:');
    unmatched.forEach((s) => console.log(`  - ${s.siteId} (${s.domains.join(', ')})`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
