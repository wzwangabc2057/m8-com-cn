import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import { getPlatformSettings, savePlatformSettings, type PlatformSettings } from '@/lib/platform-settings-d1';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const env = await getEnv();
  try {
    const settings = await getPlatformSettings(env.DB);
    const effectiveMedusaBackendUrl =
      env.MEDUSA_BACKEND_URL || settings.medusa?.backendUrl || '';
    return jsonResponse({ ...settings, effectiveMedusaBackendUrl });
  } catch (err: any) {
    return errorResponse(err.message || 'Failed to load global settings', 500);
  }
}

export async function PUT(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const env = await getEnv();
  try {
    const body = await req.json() as Partial<PlatformSettings>;
    await savePlatformSettings(env.DB, body);
    const updated = await getPlatformSettings(env.DB);
    return jsonResponse(updated);
  } catch (err: any) {
    return errorResponse(err.message || 'Failed to save global settings', 500);
  }
}
