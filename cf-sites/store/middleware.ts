import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import type { StoreEnv } from '@/lib/cloudflare';
import { fetchStoreConfig, getLookupFromHeaders } from '@/lib/store-config';
import { resolveStoreMessages } from '@/lib/i18n';

async function isStoreEnabled(request: NextRequest, env?: StoreEnv): Promise<boolean> {
  if (!env) return true; // Fail open in dev without env
  try {
    const lookup = getLookupFromHeaders(request.headers, env.SITE_ID);
    const { config } = await fetchStoreConfig(env, lookup);
    return config.enabled !== false;
  } catch (e) {
    return true;
  }
}

export async function middleware(request: NextRequest) {
  // Only intercept store routes, not static assets or APIs
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  try {
    // Get environment bindings from request context
    const { env } = getRequestContext();
    const storeEnv = env as unknown as StoreEnv;

    // Check if store is enabled
    const enabled = await isStoreEnabled(request, storeEnv);

    if (!enabled) {
      const lookup = getLookupFromHeaders(request.headers, storeEnv.SITE_ID);
      const { language } = await fetchStoreConfig(storeEnv, lookup);
      const messages = resolveStoreMessages(language);

      // Return a simple maintenance response directly
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>${messages.maintenanceTitle}</title>
            <style>
              body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #334155; }
              .container { text-align: center; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
              h1 { margin-bottom: 0.5rem; color: #0f172a; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>${messages.maintenanceTitle}</h1>
              <p>${messages.maintenanceMessage}</p>
            </div>
          </body>
        </html>`,
        {
          status: 503,
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
        }
      );
    }
  } catch (e) {
    // getRequestContext might throw in local dev if setupDevPlatform is not initialized properly
    console.warn('Middleware context error (likely dev mode):', e);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
