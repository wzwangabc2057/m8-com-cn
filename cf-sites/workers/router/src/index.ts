/**
 * Edge Router Worker
 * 
 * Routes requests to the appropriate service based on URL path:
 * - Store paths (/store, /products, /cart, /checkout, /account, /api/*) -> Store Service
 * - Everything else (/, /blog, /category, /tag, /author, etc.) -> Blog Service
 * 
 * Bound to custom domain tmp.aiball.world via Workers Routes.
 * Uses origin-fetch to Pages projects.
 */

interface Env {
  BLOG_ORIGIN: string;
  STORE_ORIGIN: string;
}

const STORE_PREFIXES = [
  '/store',
  '/products',
  '/cart',
  '/checkout',
  '/account',
  '/api/store',
  '/api/cart',
  '/api/checkout',
  '/api/turnstile',
  '/api/analytics',
  '/_next',       // Next.js static assets (CSS, JS, etc.)
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Route to store service if path matches store prefixes
    const isStore = STORE_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + '/'),
    );

    const origin = isStore ? env.STORE_ORIGIN : env.BLOG_ORIGIN;

    // Rewrite the URL to the target origin while preserving path + query
    const targetUrl = `${origin}${pathname}${url.search}`;

    // Create a new request, forwarding original Host and Proto for backend redirects
    const headers = new Headers(request.headers);
    headers.set('X-Forwarded-Host', url.hostname);
    headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

    const newRequest = new Request(targetUrl, {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual',
    });

    // Fetch from origin
    const res = await fetch(newRequest);

    // Clone the response so we can modify headers if needed
    const resHeaders = new Headers(res.headers);
    
    // Ensure proper CORS for the custom domain
    resHeaders.set('X-Routed-To', isStore ? 'store' : 'blog');

    // Rewrite Location header in 3xx redirects: if backend returns origin URL (pages.dev),
    // replace with original request host so user stays on custom domain (e.g. aiball.world)
    const status = res.status;
    if (status >= 300 && status < 400) {
      const location = resHeaders.get('Location');
      if (location) {
        try {
          const locUrl = new URL(location, url.origin);
          const targetOrigin = isStore ? env.STORE_ORIGIN : env.BLOG_ORIGIN;
          if (locUrl.origin === targetOrigin) {
            const proto = url.protocol.replace(':', '');
            const newLocation = `${proto}://${url.hostname}${locUrl.pathname}${locUrl.search}`;
            resHeaders.set('Location', newLocation);
          }
        } catch (_) {}
      }
    }

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
    });
  },
};
