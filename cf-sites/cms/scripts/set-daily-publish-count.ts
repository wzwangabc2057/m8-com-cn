#!/usr/bin/env npx tsx
/**
 * 将 daily-topic-finder/data/sites 下所有站点的「每日发布数」改为 100（config.publish.postsPerDay）。
 * 用法：在 daily-topic-finder 下执行（需能读到 CMS_API_URL、CMS_API_KEY）：
 *   npx tsx -r dotenv/config ../cms/scripts/set-daily-publish-count.ts
 * 或在项目根：npx tsx -r dotenv/config cms/scripts/set-daily-publish-count.ts
 * 依赖：CMS_API_URL、CMS_API_KEY 环境变量
 */
import fs from 'fs/promises';
import path from 'path';

const CMS_URL = (process.env.CMS_API_URL ?? '').replace(/\/$/, '');
const CMS_KEY = (process.env.CMS_API_KEY ?? '').trim();
const POSTS_PER_DAY = 100;

async function getSiteIds(): Promise<string[]> {
  const base = process.cwd();
  const candidates = [
    path.join(base, 'data', 'sites'),
    path.join(base, 'daily-topic-finder', 'data', 'sites'),
  ];
  let dataSites = candidates[0];
  for (const dir of candidates) {
    try {
      await fs.access(dir);
      dataSites = dir;
      break;
    } catch {
      continue;
    }
  }
  const entries = await fs.readdir(dataSites, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name);
}

async function main() {
  if (!CMS_URL || !CMS_KEY) {
    console.error('请设置 CMS_API_URL 和 CMS_API_KEY');
    process.exit(1);
  }

  const SITE_IDS = await getSiteIds();
  console.log(`从 data/sites 读取到 ${SITE_IDS.length} 个站点，将每日发布数设为 ${POSTS_PER_DAY}\n`);

  const headers = {
    Authorization: `Bearer ${CMS_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  for (const siteId of SITE_IDS) {
    try {
      const getRes = await fetch(`${CMS_URL}/api/config?siteId=${encodeURIComponent(siteId)}`, { headers });
      if (!getRes.ok) {
        console.warn(`[${siteId}] GET config 失败: ${getRes.status}`);
        continue;
      }
      const { config: existing } = (await getRes.json()) as { config: { publish?: { postsPerDay?: number } } };
      const current = existing?.publish?.postsPerDay ?? 10;

      const body = {
        publish: {
          ...(existing?.publish && typeof existing.publish === 'object' ? existing.publish : {}),
          postsPerDay: POSTS_PER_DAY,
        },
      };

      const putRes = await fetch(`${CMS_URL}/api/config?siteId=${encodeURIComponent(siteId)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });
      if (!putRes.ok) {
        console.warn(`[${siteId}] PUT config 失败: ${putRes.status} ${await putRes.text()}`);
        continue;
      }
      console.log(`[${siteId}] 每日发布数 ${current} → ${POSTS_PER_DAY}`);
    } catch (e: any) {
      console.warn(`[${siteId}] 错误:`, e.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
