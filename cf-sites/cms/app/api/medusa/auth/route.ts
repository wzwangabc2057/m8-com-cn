import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { NextRequest } from 'next/server';
import Medusa from '@medusajs/js-sdk';
import { savePlatformSettings } from '@/lib/platform-settings-d1';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { email, password } = await req.json();
  const env = await getEnv();

  if (!email || !password) return errorResponse('Email and password required');

  const baseUrl = env.MEDUSA_BACKEND_URL;
  if (!baseUrl) return errorResponse('Medusa Backend URL not configured in environment', 500);

  try {
    const sdk = new Medusa({
      baseUrl: baseUrl.replace(/\/$/, ''),
      debug: false,
      auth: {
        type: 'jwt', // Request JWT token
      },
    });

    // Attempt login (Medusa v2: may return JWT string directly or an object)
    const response = await sdk.auth.login('user', 'emailpass', {
      email,
      password,
    });

    const token =
      typeof response === 'string'
        ? response
        : (response as any)?.access_token ?? (response as any)?.token;

    if (token) {
      await savePlatformSettings(env.DB, {
        medusa: {
          adminApiToken: token,
          backendUrl: baseUrl,
        },
      });
      return jsonResponse({ success: true, token });
    }
    
    return jsonResponse({ success: false, message: 'Login successful but no token received', response }, 200);
  } catch (err: any) {
    console.error('Medusa login error:', err);
    const msg = err.message || 'Failed to authenticate with Medusa';
    const isInvalidCreds = /invalid email|invalid password|unauthorized|401/i.test(msg) || (err.response?.status === 401);
    return jsonResponse(
      {
        error: isInvalidCreds ? 'Invalid email or password. Check credentials on your Medusa backend.' : msg,
        details: err.response?.data ?? undefined,
      },
      err.response?.status ?? 401
    );
  }
}
