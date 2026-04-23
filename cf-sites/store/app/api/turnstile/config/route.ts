import { getEnv } from '@/lib/cloudflare';

export const runtime = 'edge';

export async function GET() {
  const env = getEnv();
  const rawSiteKey = env.TURNSTILE_SITE_KEY?.trim() || '';
  const siteKey = rawSiteKey && !/^<.*>$/.test(rawSiteKey) ? rawSiteKey : '';

  return Response.json({
    enabled: !!siteKey,
    siteKey: siteKey || null,
  });
}
