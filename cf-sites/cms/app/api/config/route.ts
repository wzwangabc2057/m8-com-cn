import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { getConfig, putConfig } from '@/lib/r2-utils';
import { getDomainMap, setTransformations, findZoneForHostname } from '@/lib/cloudflare-api';
import { invalidateCache, configCacheKeys } from '@/lib/cache-invalidation';
import { NextRequest } from 'next/server';
import type { SiteConfig } from '@/lib/types';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId');

  const env = await getEnv();
  const [config, domainMap] = await Promise.all([
    getConfig(env.CONTENT_BUCKET, siteId),
    getDomainMap(env.CONTENT_BUCKET),
  ]);
  const domainsForSite = Object.entries(domainMap)
    .filter(([, sid]) => sid === siteId)
    .map(([host]) => host);
  const siteBaseUrl = domainsForSite[0] ? `https://${domainsForSite[0]}`.replace(/\/$/, '') : '';

  return jsonResponse({ config, siteBaseUrl });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId');

  try {
    const body = await req.json<Partial<SiteConfig>>();
    const env = await getEnv();
    const existing = await getConfig(env.CONTENT_BUCKET, siteId);
    
    const updated = { ...existing, ...body };
    await putConfig(env.CONTENT_BUCKET, siteId, updated);

    // Auto-enable Cloudflare Image Resizing (transformations) on the zone when imageResizing is turned on
    let transformationsResult: { success: boolean; error?: string } | null = null;
    if (updated.imageResizing === true && env.CF_API_TOKEN) {
      let zoneId = updated.zoneId;
      if (!zoneId) {
        const domainMap = await getDomainMap(env.CONTENT_BUCKET);
        const firstDomain = Object.entries(domainMap).find(([, sid]) => sid === siteId)?.[0];
        if (firstDomain) {
          const zone = await findZoneForHostname(env.CF_API_TOKEN, firstDomain);
          zoneId = zone?.id;
        }
      }
      if (zoneId) {
        transformationsResult = await setTransformations(env.CF_API_TOKEN, zoneId, true);
      }
    }

    // Invalidate cache
    await invalidateCache(env.EVENTS_QUEUE, configCacheKeys(siteId));

    return jsonResponse({
      success: true,
      config: updated,
      ...(transformationsResult && !transformationsResult.success && {
        warning: `Config saved, but failed to enable Image Resizing on zone: ${transformationsResult.error}`,
      }),
    });
  } catch (err: any) {
    return errorResponse(err.message || 'Failed to update config');
  }
}
