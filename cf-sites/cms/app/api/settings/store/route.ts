import { NextRequest, NextResponse } from 'next/server';
import { getSiteSettings } from '@/lib/settings-d1';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { getDomainMap } from '@/lib/cloudflare-api';
import { getConfig } from '@/lib/r2-utils';

export const runtime = 'edge';

function normalizeDomain(value?: string | null): string | null {
  const raw = value?.trim().toLowerCase();
  if (!raw) return null;

  if (/^https?:\/\//.test(raw)) {
    try {
      return new URL(raw).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  return raw.replace(/:\d+$/, '');
}

async function resolveSiteIdByDomain(bucket: R2Bucket, domain: string): Promise<string | null> {
  const domainMap = await getDomainMap(bucket);
  if (domainMap[domain]) {
    return domainMap[domain];
  }

  const siteIds: string[] = [];
  let cursor: string | undefined;

  do {
    const list = await bucket.list({
      prefix: 'sites/',
      delimiter: '/',
      cursor,
    });

    list.delimitedPrefixes.forEach((prefix) => {
      const parts = prefix.split('/');
      if (parts[1]) siteIds.push(parts[1]);
    });

    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);

  for (const siteId of siteIds) {
    try {
      const config = await getConfig(bucket, siteId);
      if (!config.url) continue;

      try {
        const hostname = new URL(config.url).hostname.toLowerCase();
        if (hostname === domain || config.url.toLowerCase() === domain) {
          return siteId;
        }
      } catch {
        // Ignore malformed URLs in site config and continue lookup.
      }
    } catch {
      // Ignore missing or malformed config for legacy folders.
    }
  }

  return null;
}

/**
 * GET /api/settings/store?siteId=xxx
 * Returns store config for the given site (for storefront use).
 * No auth required so the storefront can fetch medusaPublishableKey, etc.
 */
export async function GET(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const { searchParams } = new URL(request.url);
    const explicitSiteId = searchParams.get('siteId')?.trim();
    const requestedDomain = normalizeDomain(
      searchParams.get('domain') ||
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host')
    );

    let siteId = explicitSiteId || 'default';

    if (!explicitSiteId && requestedDomain) {
      const resolvedSiteId = await resolveSiteIdByDomain(env.CONTENT_BUCKET, requestedDomain);
      if (resolvedSiteId) {
        siteId = resolvedSiteId;
      }
    }

    const settings = await getSiteSettings(env.DB, siteId);
    let language = 'en';

    try {
      const config = await getConfig(env.CONTENT_BUCKET, siteId);
      language = config.language || 'en';
    } catch {
      // Keep public store config endpoint resilient even if site config is missing.
    }

    return NextResponse.json({ store: settings.store ?? {}, resolvedSiteId: siteId, language });
  } catch (error) {
    console.error('Failed to fetch store settings:', error);
    return NextResponse.json({ error: 'Failed to fetch store settings' }, { status: 500 });
  }
}
