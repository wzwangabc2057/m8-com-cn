import { getEnv, jsonResponse, errorResponse } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { getConfig, getPost, savePost } from '@/lib/r2-utils';
import { getDomainMap } from '@/lib/cloudflare-api';
import { savePostToD1 } from '@/lib/d1-utils';
import { processWritingJobImages } from '@/lib/image-processor';
import {
  listProjects,
  listJobs,
  getJob,
  getJobFiles,
  downloadJobFile,
  type JobDetail,
} from '@/lib/writing-api';
import type { Post } from '@/lib/types';

/** Decode URL-encoded text from API for storage (avoids displaying %E0%B8%... as-is). */
function safeDecodeUri(s: string): string {
  if (!s || typeof s !== 'string') return s;
  try {
    if (!/%[0-9A-Fa-f]{2}/.test(s)) return s;
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export const runtime = 'edge';
export const maxDuration = 300;

/**
 * Clean up AI-generated HTML content before saving to CMS:
 * 1. Unwrap <article class="article-container"> and similar wrappers
 * 2. Remove leading duplicate title (H1/P that matches post title)
 * 3. Remove bylines like "Oleh: Author" and watermarks like "aiball.world Analysis"
 */
function cleanAiContent(content: string, title: string): string {
  if (!content) return content;
  let html = content.trim();

  // 0. Extract body if content is a full HTML document (contains <head>/<meta>/<title>)
  const hasDocMarkers = /<!DOCTYPE\s/i.test(html) || /^<html[\s>]/i.test(html) ||
    (/<head[\s>]/i.test(html) && /<meta\s/i.test(html));
  const startsWithMeta = /^\s*(<meta[\s][^>]*>\s*)+/i.test(html);
  if (hasDocMarkers || startsWithMeta) {
    html = html.replace(/<!DOCTYPE[^>]*>\s*/gi, '');
    html = html.replace(/<html[^>]*>\s*/gi, '').replace(/<\/html>\s*/gi, '');
    html = html.replace(/<head[^>]*>[\s\S]*?<\/head>\s*/gi, '');
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) html = bodyMatch[1].trim();
    html = html.replace(/^(\s*(<meta\s[^>]*>\s*|<title[^>]*>[\s\S]*?<\/title>\s*|<link\s[^>]*>\s*|<!--[\s\S]*?-->\s*))+/gi, '').trim();
  }

  // 1. Unwrap article/div/section containers
  const wrapperRe = /^\s*<(article|div|section)\s+class\s*=\s*"[^"]*(?:article-container|article-content|post-container|content-wrapper|entry-content)[^"]*"\s*>([\s\S]*)<\/\1>\s*$/i;
  const wrapperMatch = html.match(wrapperRe);
  if (wrapperMatch) html = wrapperMatch[2].trim();

  // Also unwrap plain <article>...</article>
  const plainMatch = html.match(/^\s*<article(?:\s+[^>]*)?\s*>([\s\S]*)<\/article>\s*$/i);
  if (plainMatch) html = plainMatch[1].trim();

  // 2. Remove leading elements that duplicate the title or are boilerplate
  const normalizedTitle = title.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const titleWords = normalizedTitle.split(/\s+/).filter(w => w.length > 2);

  const isTitleLike = (text: string) => {
    const t = text.toLowerCase().trim();
    if (!t || t.length < 5) return false;
    if (t === normalizedTitle || normalizedTitle.includes(t) || t.includes(normalizedTitle)) return true;
    const textWords = t.split(/\s+/).filter(w => w.length > 2);
    if (titleWords.length === 0) return false;
    const overlap = titleWords.filter(w => textWords.includes(w)).length;
    return overlap / titleWords.length > 0.5;
  };

  const plainText = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

  for (let i = 0; i < 5; i++) {
    const t = html.trimStart();
    const blockMatch = t.match(/^<(h[1-6]|p|div)[^>]*>([\s\S]*?)<\/\1>\s*/i);
    if (blockMatch) {
      const text = plainText(blockMatch[2]);
      if (isTitleLike(text)) { html = t.slice(blockMatch[0].length).trim(); continue; }
      if (/^(oleh|by|author|penulis)\s*[:：]/i.test(text)) { html = t.slice(blockMatch[0].length).trim(); continue; }
      if (/aiball\.world\s*(analysis|analisis)/i.test(text) || /\|\s*aiball\.world/i.test(text)) { html = t.slice(blockMatch[0].length).trim(); continue; }
    }
    const bareMatch = t.match(/^([^<]{10,}?)(?=<)/);
    if (bareMatch && isTitleLike(bareMatch[1].trim())) { html = t.slice(bareMatch[0].length).trim(); continue; }
    break;
  }

  // 3. Downgrade any remaining <h1> to <h2> within the content,
  // since the page template will provide the main <h1> for the post title.
  html = html.replace(/<h1/gi, '<h2').replace(/<\/h1>/gi, '</h2>');

  return html;
}

const JOB_TIMEOUT_HOURS = 12;

function requireCronAuth(req: NextRequest, env: { CRON_SECRET?: string }): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('X-Cron-Secret') || req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  return auth === secret;
}

function parseDomain(url: string): string | null {
  if (!url?.trim()) return null;
  try {
    const u = url.startsWith('http') ? url : `https://${url}`;
    return new URL(u).hostname;
  } catch {
    return null;
  }
}

const SITE_PROJECT_PATTERN = /^site_\d+_\d+$/;

function findProjectByDomain(
  projects: { id: string; domain: string | null; language?: string }[],
  siteDomain: string,
  siteLanguage?: string
): { id: string; domain: string | null } | undefined {
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

function isJobOlderThanHours(createdAt: string, hours: number): boolean {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return (now - created) / (1000 * 60 * 60) > hours;
}

async function saveJobAsDraft(
  env: Awaited<ReturnType<typeof getEnv>>,
  siteId: string,
  job: JobDetail,
  jobId: string,
  dryRun: boolean,
  existing: Post | null
): Promise<void> {
  const meta = job.result?.metadata;
  const slug = meta?.slug || jobId.replace(/^job_/, '');
  const title = safeDecodeUri(meta?.meta?.title || slug);
  const excerpt = safeDecodeUri(meta?.meta?.description || '');
  const completedAt = job.completed_at || new Date().toISOString();
  const isOverwritingPublished = existing?.status === 'published';

  let files = (job.result?.files || []).map((f) => ({ name: f.name, type: f.type, size: f.size }));
  if (files.length === 0) {
    try {
      const filesResp = await getJobFiles(env as any, jobId);
      files = (filesResp.files || []).map((f) => ({ name: f.name, type: f.type, size: f.size }));
    } catch {
      /* best effort */
    }
  }
  const htmlFile = files.find((f) => f.type === 'html' || f.name.endsWith('.html'));
  const mdFile = files.find((f) => f.type === 'markdown' || f.name.endsWith('.md'));

  let content = '';
  const apiKey =
    (env as any).ARTICLE_WRITING_API_KEY ||
    (env as any).ARTICLE_WRITING_SYSTEM_API_TOKEN;
  if (!apiKey) throw new Error('ARTICLE_WRITING_API_KEY required');

  if (htmlFile) {
    const buffer = await downloadJobFile(env as any, jobId, htmlFile.name);
    content = new TextDecoder().decode(buffer);
  } else if (mdFile) {
    const buffer = await downloadJobFile(env as any, jobId, mdFile.name);
    content = new TextDecoder().decode(buffer);
  }

  if (!dryRun) {
    content = await processWritingJobImages(
      content,
      siteId,
      env.CONTENT_BUCKET,
      jobId,
      apiKey
    );
  }

  // Clean up AI-generated content structure before saving
  content = cleanAiContent(content, title);

  const metaObj = (meta?.meta || {}) as Record<string, unknown>;
  const metaAuthorRaw = typeof metaObj.author === 'string' ? metaObj.author.trim() : '';
  const metaCategoryRaw = typeof metaObj.category === 'string' ? metaObj.category.trim() : '';

  async function getJson<T>(key: string, fallback: T): Promise<T> {
    const obj = await env.CONTENT_BUCKET.get(key);
    if (!obj) return fallback;
    return obj.json<T>();
  }
  async function putJson(key: string, data: unknown): Promise<void> {
    await env.CONTENT_BUCKET.put(key, JSON.stringify(data, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });
  }
  function slugify(s: string): string {
    return s
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u4e00-\u9fa5-]/gi, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'default';
  }

  const authorsKey = `sites/${siteId}/meta/authors.json`;
  const categoriesKey = `sites/${siteId}/meta/categories.json`;
  let authorsList: { id: string; name: string }[] = [];
  let categoriesList: { slug: string; name: string }[] = [];
  try {
    authorsList = await getJson(authorsKey, []);
    categoriesList = await getJson(categoriesKey, []);
  } catch { /* use [] */ }

  let resolvedAuthor = '';
  if (metaAuthorRaw) {
    const byId = authorsList.find((a) => a.id === metaAuthorRaw || a.id === slugify(metaAuthorRaw));
    const byName = authorsList.find((a) => a.name === metaAuthorRaw);
    if (byId) resolvedAuthor = byId.id;
    else if (byName) resolvedAuthor = byName.id;
    else {
      const newId = slugify(metaAuthorRaw);
      authorsList.push({ id: newId, name: metaAuthorRaw });
      if (!dryRun) await putJson(authorsKey, authorsList);
      resolvedAuthor = newId;
    }
  }
  if (!resolvedAuthor && authorsList.length > 0) resolvedAuthor = authorsList[0].id;

  let resolvedCategories: string[] = [];
  if (metaCategoryRaw) {
    const decoded = safeDecodeUri(metaCategoryRaw);
    const slug = slugify(decoded);
    const existing = categoriesList.find((c) => c.slug === slug);
    if (existing) resolvedCategories = [existing.slug];
    else {
      categoriesList.push({ slug, name: decoded || slug });
      if (!dryRun) await putJson(categoriesKey, categoriesList);
      resolvedCategories = [slug];
    }
  }

  const allKeywords = (meta?.meta?.keywords || []).map((k: string) => safeDecodeUri(k));
  if (resolvedCategories.length === 0 && allKeywords.length > 0) resolvedCategories = [allKeywords[0]];
  const tags = allKeywords.filter((k: string) => !resolvedCategories.includes(k));

  const post: Post = {
    slug,
    title,
    excerpt,
    content,
    author: resolvedAuthor,
    categories: resolvedCategories,
    tags,
    collection: '',
    publishedAt: isOverwritingPublished && existing?.publishedAt ? existing.publishedAt : completedAt,
    updatedAt: isOverwritingPublished && existing?.updatedAt ? existing.updatedAt : completedAt,
    type: 'post',
    status: isOverwritingPublished && existing?.status ? existing.status : 'draft',
    seo: meta?.meta
      ? {
        title: meta.meta.title,
        description: meta.meta.description,
        ogImage: meta.og?.title ? undefined : undefined,
      }
      : undefined,
  };

  // 优先匹配 header/cover/featured；若无则取 images/ 下任意图片（Writing API 可能输出 hero、lead 等）
  const imageExts = /\.(webp|png|jpg|jpeg|gif)$/i;
  const isImageInImages = (f: { name: string; type?: string }) =>
    f.name.includes('images/') &&
    (f.type?.startsWith('image/') || imageExts.test(f.name));
  const coverImageFile =
    files.find(
      (f) =>
        isImageInImages(f) &&
        (f.name.includes('header') || f.name.includes('cover') || f.name.includes('featured'))
    ) ?? files.find(isImageInImages);
  if (coverImageFile && content && !dryRun) {
    const buffer = await downloadJobFile(env as any, jobId, coverImageFile.name);
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const ext = coverImageFile.name.split('.').pop() || 'webp';
    const filename = `cover-${crypto.randomUUID().split('-')[0]}.${ext}`;
    const key = `sites/${siteId}/assets/uploads/${y}/${m}/${filename}`;
    await env.CONTENT_BUCKET.put(key, buffer, {
      httpMetadata: {
        contentType: coverImageFile.type === 'image' ? `image/${ext}` : 'image/webp',
      },
    });
    post.coverImage = `/site-assets/uploads/${y}/${m}/${filename}`;
  }

  if (dryRun) return;

  await savePost(env.CONTENT_BUCKET, siteId, post);
  await savePostToD1(env.DB, siteId, post);

  if (env.EVENTS_QUEUE) {
    try {
      const { invalidateCache, postCacheKeys } = await import('@/lib/cache-invalidation');
      await invalidateCache(env.EVENTS_QUEUE, postCacheKeys(siteId, post.slug));
    } catch {
      /* best effort */
    }
  }
}

/**
 * POST /api/cron/sync-writing-tasks
 * Cron-triggered sync. Auth: X-Cron-Secret or Authorization: Bearer ${CRON_SECRET}
 * Query:
 *   dryRun=true            - run without writing to R2/D1
 *   rematch=true           - re-match project by domain and clear lastJobId
 *   resetLastJobId=true    - clear lastJobId so next run processes from earliest completed job
 *   overwriteDraft=false   - do not overwrite existing draft posts (default: true = allow overwrite)
 *   forceOverwrite=true    - overwrite published posts too (default: false = never overwrite published)
 */
export async function POST(req: NextRequest) {
  const env = await getEnv();
  if (!requireCronAuth(req, env)) {
    return errorResponse('Unauthorized', 401);
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === 'true';
  const rematch = url.searchParams.get('rematch') === 'true';
  const siteFilter = url.searchParams.get('siteId') || undefined;
  const resetLastJobId = url.searchParams.get('resetLastJobId') === 'true';
  const overwriteDraft = url.searchParams.get('overwriteDraft') !== 'false'; // default true: allow overwriting draft posts
  // forceOverwrite: if true, overwrite published posts (dangerous: resets publishedAt/status). Default: false = skip published.
  const forceOverwrite = url.searchParams.get('forceOverwrite') === 'true';

  const bucket = env.CONTENT_BUCKET;
  const db = env.DB;

  const siteIds: string[] = [];
  let cursor: string | undefined = undefined;
  do {
    const list = await bucket.list({ prefix: 'sites/', delimiter: '/', cursor });
    for (const prefix of list.delimitedPrefixes) {
      const parts = prefix.split('/');
      if (parts[1]) siteIds.push(parts[1]);
    }
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);

  const domainMap = await getDomainMap(bucket);
  const domainsBySite: Record<string, string[]> = {};
  for (const [host, sid] of Object.entries(domainMap)) {
    if (!domainsBySite[sid]) domainsBySite[sid] = [];
    domainsBySite[sid].push(host);
  }

  const summary = {
    sitesProcessed: 0,
    sitesSkipped: 0,
    jobsSaved: 0,
    jobsTimedOut: 0,
    jobsSkipped: 0,
    jobsStopped: 0,
    jobsProcessed: 0,
    errors: [] as string[],
    jobs: [] as any[]
  };

  const sitesWithDomain: { siteId: string; domains: string[]; language?: string }[] = [];
  for (const id of siteIds) {
    const domains = new Set<string>();
    let language: string | undefined;
    try {
      const conf = await getConfig(bucket, id);
      if ((conf as { writingSyncEnabled?: boolean }).writingSyncEnabled === false) {
        summary.sitesSkipped++;
        continue;
      }
      const fromUrl = parseDomain(conf.url || '');
      if (fromUrl) domains.add(fromUrl);
      language = (conf as { language?: string }).language;
    } catch {
      /* skip */
    }
    for (const d of domainsBySite[id] || []) domains.add(d);
    if (domains.size === 0 && id.includes('.')) domains.add(id);
    if (domains.size > 0) sitesWithDomain.push({ siteId: id, domains: [...domains], language });
  }

  for (const { siteId, domains, language } of sitesWithDomain) {
    if (siteFilter && siteId !== siteFilter) continue;
    try {
      let row = await db.prepare('SELECT projectId, lastJobId FROM writing_sync WHERE siteId = ?').bind(siteId).first<{ projectId: string; lastJobId: string | null }>();

      let projectId: string;
      if (row?.projectId && !rematch) {
        projectId = row.projectId;
      } else {
        const projects = await listProjects(env as any);
        let match: { id: string; domain: string | null } | undefined;
        for (const domain of domains) {
          match = findProjectByDomain(projects, domain, language);
          if (match) break;
        }
        if (!match) {
          summary.sitesSkipped++;
          continue;
        }
        projectId = match.id;
        if (!dryRun) {
          await db.prepare(
            'INSERT INTO writing_sync (siteId, projectId, lastJobId, updatedAt) VALUES (?, ?, NULL, ?) ON CONFLICT(siteId) DO UPDATE SET projectId = excluded.projectId, lastJobId = NULL, updatedAt = excluded.updatedAt'
          )
            .bind(siteId, projectId, new Date().toISOString())
            .run();
        }
      }

      let lastJobId: string | null;
      if (resetLastJobId) {
        if (!dryRun) {
          await db.prepare('UPDATE writing_sync SET lastJobId = NULL, updatedAt = ? WHERE siteId = ?')
            .bind(new Date().toISOString(), siteId)
            .run();
        }
        lastJobId = null;
      } else {
        lastJobId = (await db.prepare('SELECT lastJobId FROM writing_sync WHERE siteId = ?').bind(siteId).first<{ lastJobId: string | null }>())?.lastJobId ?? null;
      }
      let hasMore = true;

      while (hasMore) {
        let jobs: { job_id: string; project_id: string; job_type: string; status: string; created_at: string }[];
        let has_more: boolean;
        try {
          const res = await listJobs(env as any, projectId, {
            after: lastJobId || undefined,
            limit: 100,
            order: 'asc',
          });
          jobs = res.jobs;
          has_more = res.has_more ?? false;
        } catch (e: any) {
          summary.errors.push(`site ${siteId} listJobs: ${e.message}`);
          break;
        }

        hasMore = has_more;

        const persistCursor = async () => {
          if (lastJobId && !dryRun) {
            await db.prepare(
              'INSERT INTO writing_sync (siteId, projectId, lastJobId, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(siteId) DO UPDATE SET lastJobId = excluded.lastJobId, updatedAt = excluded.updatedAt'
            )
              .bind(siteId, projectId, lastJobId, new Date().toISOString())
              .run();
          }
        };

        for (const job of jobs) {
          if (isJobOlderThanHours(job.created_at, JOB_TIMEOUT_HOURS) && job.status !== 'completed') {
            lastJobId = job.job_id;
            summary.jobsTimedOut++;
            await persistCursor();
            continue;
          }

          if (job.status === 'pending' || job.status === 'running') {
            hasMore = false;
            summary.jobsStopped++;
            break;
          }

          lastJobId = job.job_id;

          if (job.job_type !== 'generate') {
            summary.jobsSkipped++;
            await persistCursor();
            continue;
          }

          if (job.status === 'completed') {
            try {
              const detail = await getJob(env as any, job.job_id);
              const slug = detail.result?.metadata?.slug || job.job_id.replace(/^job_/, '');
              const existing = await getPost(env.CONTENT_BUCKET, siteId, slug);
              if (existing && !forceOverwrite && (!overwriteDraft || existing.status !== 'draft')) {
                summary.jobsSkipped++;
                await persistCursor();
                continue;
              }
              summary.jobs.push(job);
              await saveJobAsDraft(env, siteId, detail, job.job_id, dryRun, existing ?? null);
              summary.jobsSaved++;
            } catch (e: any) {
              summary.errors.push(`job ${job.job_id}: ${e.message}`);
            }
            await persistCursor();
          } else {
            summary.jobsSkipped++;
            await persistCursor();
          }
        }

        await persistCursor();

        if (!hasMore) break;
      }

      summary.sitesProcessed++;
    } catch (e: any) {
      summary.errors.push(`site ${siteId}: ${e.message}`);
      summary.sitesSkipped++;
    }
  }

  const result = dryRun ? { ...summary, dryRun: true } : summary;
  if (siteFilter) (result as any).siteFilter = siteFilter;
  return jsonResponse(result);
}
