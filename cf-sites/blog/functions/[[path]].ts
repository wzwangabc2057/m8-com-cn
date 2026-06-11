import { matchRoute } from '../src/router.js';
import { getKnownPageSlugs, getConfig } from '../src/services/content.js';
import { handleHome } from '../src/handlers/home.js';
import { handlePost } from '../src/handlers/post.js';
import { handlePage } from '../src/handlers/page.js';
import { handleCollection } from '../src/handlers/collection.js';
import { handleCategory } from '../src/handlers/category.js';
import { handleTag } from '../src/handlers/tag.js';
import { handleAuthor } from '../src/handlers/author.js';
import { handleSiteAsset } from '../src/handlers/site-assets.js';
import { handleSitemap } from '../src/handlers/sitemap.js';
import { handleRobots } from '../src/handlers/robots.js';
import { handleFeed } from '../src/handlers/feed.js';
import { handleLlms } from '../src/handlers/llms.js';
import { handleResearchIndex } from '../src/handlers/research-index.js';
import { resolveSiteId } from '../src/services/site-resolver.js';
import type { Env } from '../src/types.js';

function normalizeRedirectPath(pathname: string): string {
  return pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
}

function encodeRedirectPath(pathname: string): string {
  if (pathname === '/') return '/';
  return pathname
    .split('/')
    .map((s) => (s ? encodeURIComponent(s) : ''))
    .join('/');
}

function buildRedirectResponse(
  request: Request,
  url: URL,
  target: string,
  status: number,
): Response {
  const forwardedHost = request.headers.get('X-Forwarded-Host');
  const forwardedProto = request.headers.get('X-Forwarded-Proto');
  const redirectOrigin =
    forwardedHost
      ? `${forwardedProto === 'https' ? 'https' : forwardedProto === 'http' ? 'http' : 'https'}://${forwardedHost}`
      : url.origin;

  let location: string;
  if (/^https?:\/\//i.test(target)) {
    const targetUrl = new URL(target);
    if (!targetUrl.search && url.search) targetUrl.search = url.search;
    location = targetUrl.toString();
  } else {
    const normalized = target.startsWith('/') ? target : `/${target}`;
    const encodedPath = encodeRedirectPath(normalizeRedirectPath(normalized));
    location = `${redirectOrigin}${encodedPath}${url.search}`;
  }

  return Response.redirect(location, status);
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    pathname = url.pathname;
  }

  // Skip static assets
  if (
    pathname.startsWith('/css/') ||
    pathname.startsWith('/js/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/favicon')
  ) {
    return context.next();
  }

  // API routes: handled by api/_middleware.ts for siteId resolution
  if (pathname.startsWith('/api/')) {
    return context.next();
  }

  // Resolve siteId from hostname for page routes
  // X-Forwarded-Host is set by the Router Worker when proxying through a custom domain
  const hostname = request.headers.get('X-Forwarded-Host') || url.hostname;
  const siteId = await resolveSiteId(env.CONTENT_BUCKET, hostname, env.SITE_ID);
  const forwardedHost = request.headers.get('X-Forwarded-Host');
  const forwardedProto = request.headers.get('X-Forwarded-Proto');
  // Use actual request host (custom domain or pages.dev) for OG images, canonical, feed, etc.
  // Avoids tmp.{siteId} or wrong config.url when CMS stores siteId-based URL
  const effectiveOrigin = forwardedHost
    ? `${forwardedProto === 'https' ? 'https' : forwardedProto === 'http' ? 'http' : 'https'}://${forwardedHost.replace(/\/$/, '')}`
    : url.origin;
  let siteEnv: Env = { ...env, SITE_ID: siteId, EFFECTIVE_ORIGIN: effectiveOrigin };

  // Serve per-site assets from R2: /site-assets/{path}
  if (pathname.startsWith('/site-assets/')) {
    const assetPath = pathname.slice('/site-assets/'.length);
    // For assets we need to check contentSourceId early (before full config load)
    // Try primary siteId first, then fall back to source folder
    let assetResponse = await handleSiteAsset(siteEnv, assetPath);
    if (!assetResponse) {
      // Quick check for contentSourceId via config
      try {
        const cfg = await getConfig(env.CONTENT_BUCKET, siteId, env.CACHE);
        if (cfg.contentSourceId) {
          assetResponse = await handleSiteAsset(siteEnv, assetPath, cfg.contentSourceId);
        }
      } catch { /* ignore */ }
    }
    if (assetResponse) return assetResponse;
    return new Response('Not Found', { status: 404 });
  }

  // SEO routes (before main router)
  // Sitemap: /sitemap.xml, /sitemap-posts-N.xml, /sitemap-pages.xml, /sitemap-taxonomies.xml
  if (pathname.startsWith('/sitemap')) {
    try {
      const sitemapResponse = await handleSitemap(siteEnv, pathname);
      if (sitemapResponse) return sitemapResponse;
    } catch (err) {
      console.error('Sitemap error:', err);
      return new Response('Sitemap generation failed', { status: 500 });
    }
  }
  if (pathname === '/robots.txt') {
    return handleRobots(siteEnv);
  }
  if (pathname === '/feed.xml') {
    return handleFeed(siteEnv);
  }
  if (pathname === '/llms.txt') {
    return handleLlms(siteEnv);
  }
  if (pathname === '/research-index.json') {
    return handleResearchIndex(siteEnv);
  }

  // Redirect trailing slash URLs to non-trailing slash (except root '/')
  // Root path '/' is the HTTP minimum path — cannot be removed
  // Other paths: /blog/ → 301 → /blog
  // When behind Router Worker (X-Forwarded-Host), use original host for redirect; otherwise url.origin would point to BLOG_ORIGIN (pages.dev)
  if (pathname !== '/' && pathname.endsWith('/')) {
    const redirectPath = pathname.replace(/\/+$/, '');
    const forwardedHost = request.headers.get('X-Forwarded-Host');
    const forwardedProto = request.headers.get('X-Forwarded-Proto');
    const redirectOrigin =
      forwardedHost
        ? `${forwardedProto === 'https' ? 'https' : forwardedProto === 'http' ? 'http' : 'https'}://${forwardedHost}`
        : url.origin;
    const encodedPath = redirectPath.split('/').map(s => encodeURIComponent(s)).join('/');
    return Response.redirect(`${redirectOrigin}${encodedPath}${url.search}`, 301);
  }

  // Get site config for route mapping (with KV cache)
  const config = await getConfig(env.CONTENT_BUCKET, siteId, env.CACHE);

  // Site-managed exact redirects, e.g. old slug -> new slug after rename
  const normalizedPath = normalizeRedirectPath(pathname);
  const matchedRedirect = (config.redirects ?? []).find((rule) => normalizeRedirectPath(rule.from) === normalizedPath);
  if (matchedRedirect?.to) {
    return buildRedirectResponse(request, url, matchedRedirect.to, matchedRedirect.status ?? 301);
  }

  // Disabled site: return 503 Service Unavailable
  if (config.disabled) {
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Site Offline</title><meta name="robots" content="noindex"><style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui,sans-serif;background:#f8fafc;color:#334155}div{text-align:center}h1{font-size:3rem;font-weight:800;margin-bottom:.5rem}p{color:#64748b}</style></head><body><div><h1>503</h1><p>This site is currently offline.</p></div></body></html>`,
      { status: 503, headers: { 'Content-Type': 'text/html;charset=UTF-8', 'X-Robots-Tag': 'noindex', 'Retry-After': '3600' } },
    );
  }

  // Reverse proxy: pathPrefix -> target. Supports single object or array.
  const proxyRules = Array.isArray(config.proxy) ? config.proxy : config.proxy ? [config.proxy] : [];
  const proxyMatch = proxyRules.find((r) => r.pathPrefix && r.target && pathname.startsWith(r.pathPrefix));
  if (proxyMatch) {
    const targetBase = proxyMatch.target.replace(/\/+$/, '');
    const targetUrl = `${targetBase}${pathname}${url.search}`;
    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.delete('Host');
    proxyHeaders.set('Host', new URL(targetBase).host);
    try {
      const proxyRes = await fetch(targetUrl, {
        method: request.method,
        headers: proxyHeaders,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        redirect: 'manual',
      });
      const resHeaders = new Headers(proxyRes.headers);
      // Rewrite Location in 3xx: backend URL -> frontend URL
      if (proxyRes.status >= 300 && proxyRes.status < 400) {
        const loc = resHeaders.get('Location');
        if (loc) {
          try {
            const locUrl = new URL(loc, targetBase);
            if (locUrl.origin === new URL(targetBase).origin) {
              const origin = forwardedHost
                ? `${forwardedProto === 'https' ? 'https' : forwardedProto === 'http' ? 'http' : 'https'}://${forwardedHost}`
                : url.origin;
              resHeaders.set('Location', `${origin}${locUrl.pathname}${locUrl.search}`);
            }
          } catch { /* keep original */ }
        }
      }
      return new Response(proxyRes.body, { status: proxyRes.status, statusText: proxyRes.statusText, headers: resHeaders });
    } catch (err) {
      console.error('Proxy error:', err);
      return new Response('Proxy upstream error', { status: 502 });
    }
  }

  const sourceId = config.contentSourceId;
  if (sourceId) {
    siteEnv.CONTENT_SOURCE_ID = sourceId;
  }

  // Get known page slugs from D1 (per-site)
  const knownPages = await getKnownPageSlugs(env.DB, siteId);
  const route = matchRoute(pathname, knownPages, config.routes);

  // Helper: write analytics data point (non-blocking)
  function trackPageView(pathname: string, response: Response) {
    if (env.ANALYTICS) {
      context.waitUntil(
        Promise.resolve().then(() => {
          env.ANALYTICS!.writeDataPoint({
            blobs: [
              pathname,                                         // path
              request.headers.get('referer') || '',             // referrer
              request.headers.get('user-agent') || '',          // user-agent
              siteId,                                           // site ID
            ],
            doubles: [
              response.status,                                  // HTTP status
            ],
            indexes: [siteId],                                  // index by site
          });
        }),
      );
    }
  }

  try {
    let response: Response | null = null;

    switch (route.handler) {
      case 'home':
        response = await handleHome(siteEnv, route.page);
        break;
      case 'post':
        response = await handlePost(siteEnv, route.slug);
        break;
      case 'page':
        response = await handlePage(siteEnv, route.slug);
        // Fallback to post handler if page not found in R2 (slug registered as page in D1 but content missing)
        if (!response && config.routes?.post === '' && route.slug !== 'index') {
          response = await handlePost(siteEnv, route.slug);
        }
        break;
      case 'collection':
        response = await handleCollection(siteEnv, route.key, route.page);
        break;
      case 'category':
        response = await handleCategory(siteEnv, route.slug, route.page);
        break;
      case 'tag':
        response = await handleTag(siteEnv, route.slug, route.page);
        break;
      case 'author':
        response = await handleAuthor(siteEnv, route.id, route.page);
        break;
      case 'notFound':
        break;
    }

    if (response) {
      trackPageView(pathname, response);
      return response;
    }

    return new Response(
      `<!DOCTYPE html><html lang="${config.language || 'en'}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>404 - ${config.name}</title><meta name="robots" content="noindex,follow"><link rel="stylesheet" href="/css/default.css"><style>.error-page{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;padding:2rem}.error-page h1{font-size:4rem;font-weight:800;color:#1a1a2e;margin-bottom:1rem}.error-page p{color:#64748b;margin-bottom:2rem}.error-page a{color:#4361ee;font-weight:500}</style></head><body><main class="error-page"><h1>404</h1><p>抱歉，您访问的页面不存在</p><p><a href="/">返回首页</a></p></main></body></html>`,
      {
        status: 404,
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'X-Robots-Tag': 'noindex',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  } catch (err) {
    console.error('Render error:', err);
    return new Response(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>500 - Server Error</title><meta name="robots" content="noindex"><style>.error-page{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;padding:2rem}.error-page h1{font-size:4rem;font-weight:800;color:#1a1a2e;margin-bottom:1rem}.error-page p{color:#64748b;margin-bottom:1rem}.error-page a{color:#4361ee;font-weight:500}</style></head><body><main class="error-page"><h1>500</h1><p>服务器遇到了一个问题，请稍后再试</p><p><a href="/">返回首页</a></p></main></body></html>`,
      {
        status: 500,
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'X-Robots-Tag': 'noindex',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  }
};
