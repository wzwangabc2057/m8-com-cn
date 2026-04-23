import { NextRequest, NextResponse } from 'next/server';
import { getSiteSettings, saveSiteSettings, SiteSettings } from '@/lib/settings-d1';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { requireAuth, errorResponse } from '@/lib/api-utils';

export const runtime = 'edge';

// GET: Fetch current site settings
export async function GET(request: NextRequest) {
  if (!(await requireAuth(request))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const { env } = getRequestContext();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId') || 'default';

    const settings = await getSiteSettings(env.DB, siteId);
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// POST: Save site settings
export async function POST(request: NextRequest) {
  if (!(await requireAuth(request))) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const { env } = getRequestContext();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId') || 'default';
    const body = (await request.json()) as Partial<SiteSettings>;

    await saveSiteSettings(env.DB, siteId, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
