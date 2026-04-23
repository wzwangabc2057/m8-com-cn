import Handlebars from 'handlebars';
import * as compiled from './generated/templates-compiled.js';
import { registerHelpers } from './utils/helpers.js';
import { resolveLabels } from './utils/i18n.js';
import type { RenderContext } from './types.js';

let helpersRegistered = false;

/**
 * Per-theme template cache.
 * Key: theme name -> Map<templateName, TemplateDelegate>
 */
const themeCache = new Map<string, {
  partials: Map<string, Handlebars.TemplateDelegate>;
  templates: Map<string, Handlebars.TemplateDelegate>;
}>();

const allCompiled = compiled as Record<string, unknown>;
const AVAILABLE_THEMES: string[] = (allCompiled.THEMES as string[]) || [];

function safeKey(name: string): string {
  return name.replace(/-/g, '_');
}

function ensureHelpers(): void {
  if (helpersRegistered) return;
  registerHelpers();
  helpersRegistered = true;
}

/**
 * Initialize a theme: load precompiled partials + templates from the bundle.
 */
function ensureTheme(theme: string): { partials: Map<string, Handlebars.TemplateDelegate>; templates: Map<string, Handlebars.TemplateDelegate> } {
  ensureHelpers();

  const cached = themeCache.get(theme);
  if (cached) return cached;

  const prefix = `${safeKey(theme)}__`;
  const partialsMap = new Map<string, Handlebars.TemplateDelegate>();
  const templatesMap = new Map<string, Handlebars.TemplateDelegate>();

  // Discover partials/layouts/pages for this theme from compiled exports
  for (const [exportKey, spec] of Object.entries(allCompiled)) {
    if (!exportKey.startsWith(prefix) || !spec) continue;
    const rest = exportKey.slice(prefix.length); // e.g. "partial_header", "layout_base", "page_home"

    if (rest.startsWith('partial_')) {
      const name = rest.slice('partial_'.length).replace(/_/g, '-');
      partialsMap.set(name, Handlebars.template(spec as Handlebars.TemplateDelegate));
    } else if (rest.startsWith('layout_')) {
      const name = rest.slice('layout_'.length).replace(/_/g, '-');
      templatesMap.set(`__layout__${name}`, Handlebars.template(spec as Handlebars.TemplateDelegate));
    } else if (rest.startsWith('page_')) {
      const name = rest.slice('page_'.length).replace(/_/g, '-');
      templatesMap.set(name, Handlebars.template(spec as Handlebars.TemplateDelegate));
    }
  }

  const entry = { partials: partialsMap, templates: templatesMap };
  themeCache.set(theme, entry);
  return entry;
}

// ─── HTML entity / URL decoding for template context ───────────

const _HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&ndash;': '–', '&mdash;': '—', '&lsquo;': '\u2018', '&rsquo;': '\u2019',
  '&ldquo;': '\u201C', '&rdquo;': '\u201D', '&hellip;': '…', '&nbsp;': ' ',
  '&copy;': '©', '&reg;': '®', '&trade;': '™', '&bull;': '•',
};

function _decodeHtmlEntities(s: string): string {
  if (!s || typeof s !== 'string' || !s.includes('&')) return s;
  let out = s;
  for (const [entity, char] of Object.entries(_HTML_ENTITIES)) {
    out = out.split(entity).join(char);
  }
  out = out.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return out;
}

function _tryDecodeUri(s: string): string {
  if (!s || typeof s !== 'string' || !s.includes('%')) return s;
  try { return decodeURIComponent(s); } catch { return s; }
}

function _cleanStr(s: string): string {
  return _decodeHtmlEntities(_tryDecodeUri(s));
}

function _cleanPostObj(p: Record<string, unknown>): void {
  if (typeof p.title === 'string') p.title = _cleanStr(p.title);
  if (typeof p.excerpt === 'string') p.excerpt = _cleanStr(p.excerpt);
  if (Array.isArray(p.categories)) p.categories = p.categories.map((c: unknown) => typeof c === 'string' ? _cleanStr(c) : c);
  if (Array.isArray(p.tags)) p.tags = p.tags.map((t: unknown) => typeof t === 'string' ? _cleanStr(t) : t);
  if (Array.isArray(p.categoryDisplayNames)) p.categoryDisplayNames = p.categoryDisplayNames.map((c: unknown) => typeof c === 'string' ? _cleanStr(c) : c);
}

function cleanContextStrings(ctx: Record<string, unknown>): void {
  if (ctx.post && typeof ctx.post === 'object') _cleanPostObj(ctx.post as Record<string, unknown>);
  if (typeof ctx.pageTitle === 'string') ctx.pageTitle = _cleanStr(ctx.pageTitle as string);
  if (typeof ctx.pageDescription === 'string') ctx.pageDescription = _cleanStr(ctx.pageDescription as string);
  if (Array.isArray(ctx.posts)) {
    for (const p of ctx.posts) {
      if (p && typeof p === 'object') _cleanPostObj(p as Record<string, unknown>);
    }
  }
}

/**
 * Render a page with a specific theme.
 *
 * @param theme - Theme name (e.g. "default", "minimal")
 * @param templateName - Preferred template name (e.g. "page-landing", "page-about")
 * @param context - RenderContext with site, pageTitle, etc.
 * @param fallbackTemplate - Fallback template if preferred not found (e.g. "page")
 */
export function render(
  theme: string,
  templateName: string,
  context: RenderContext,
  fallbackTemplate?: string,
): string {
  const { partials, templates } = ensureTheme(theme);

  // Create a new Handlebars environment for this render to avoid partial conflicts across themes
  const env = Handlebars.create();

  // Re-register helpers on this env
  registerHelpersOn(env);

  // Register this theme's partials
  const partialsObj = Object.fromEntries(partials);
  for (const [name, fn] of partials) {
    env.registerPartial(name, fn);
  }

  // If context has custom partials (HTML strings from R2), override theme partials.
  // We wrap raw HTML in a function to avoid env.compile() which uses eval/new Function
  // (disallowed in Cloudflare Workers). Custom partials are plain HTML — no Handlebars.
  const customPartials = (context.customPartials || {}) as Record<string, string>;
  for (const [name, html] of Object.entries(customPartials)) {
    const rawFn = (() => html) as unknown as Handlebars.TemplateDelegate;
    env.registerPartial(name, rawFn);
    partialsObj[name] = rawFn;
  }

  // Template hierarchy: try preferred, then fallback
  let pageTemplate = templates.get(templateName);
  if (!pageTemplate && fallbackTemplate) {
    pageTemplate = templates.get(fallbackTemplate);
  }
  if (!pageTemplate) {
    // Last resort: try 'page' template
    pageTemplate = templates.get('page');
  }
  if (!pageTemplate) {
    const available = [...templates.keys()].filter((k) => !k.startsWith('__layout__'));
    throw new Error(`Template "${templateName}" not found in theme "${theme}". Available: ${available.join(', ')}`);
  }

  const layoutTemplate = templates.get('__layout__base');
  if (!layoutTemplate) {
    throw new Error(`Layout "base" not found in theme "${theme}"`);
  }

  // Auto-resolve i18n labels from site language + custom overrides
  const labels = resolveLabels(
    context.site.language || 'zh-CN',
    (context.site as unknown as Record<string, unknown>).labels as Record<string, string> | undefined,
  );

  // Decode HTML entities and URL-encoded strings in post/page metadata
  try {
    cleanContextStrings(context as unknown as Record<string, unknown>);
  } catch (e) {
    console.error('[renderer] cleanContextStrings failed:', e);
  }

  // Ensure routes and labels are available in context for helpers
  const contextWithRoutes = {
    ...context,
    labels,
    routes: context.site.routes || {
      blog: 'blog',
      post: 'blog',
      category: 'category',
      tag: 'tag',
      author: 'author',
    },
  };

  const bodyHtml = pageTemplate(contextWithRoutes, { partials: partialsObj });
  const fullHtml = layoutTemplate({ ...contextWithRoutes, body: bodyHtml }, { partials: partialsObj });

  return fullHtml;
}

function registerHelpersOn(env: typeof Handlebars): void {
  env.registerHelper('formatDate', (dateStr: string, options: Handlebars.HelperOptions) => {
    if (!dateStr) return '';
    const lang = (options.data?.root as { site?: { language?: string } })?.site?.language || 'en';
    try {
      return new Date(dateStr).toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return new Date(dateStr).toISOString().slice(0, 10);
    }
  });
  env.registerHelper('currentYear', () => new Date().getFullYear());
  env.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  env.registerHelper('gt', (a: number, b: number) => a > b);
  env.registerHelper('not', (a: unknown) => !a);
  env.registerHelper('or', (a: unknown, b: unknown) => a || b);
  env.registerHelper('and', (a: unknown, b: unknown) => a && b);
  env.registerHelper('truncate', (str: string, len: number) => {
    if (!str) return '';
    if (typeof len !== 'number') len = 100;
    return str.length > len ? str.substring(0, len) + '...' : str;
  });
  env.registerHelper('json', (ctx: unknown) => JSON.stringify(ctx, null, 2));
  env.registerHelper('hasItems', (arr: unknown[]) => Array.isArray(arr) && arr.length > 0);
  env.registerHelper('fallback', (val: unknown, fb: unknown) => val || fb);
  env.registerHelper('first', (arr: unknown[]) => Array.isArray(arr) && arr.length > 0 ? arr[0] : '');
  env.registerHelper('take', (arr: unknown[], n: number) => {
    if (!Array.isArray(arr)) return [];
    if (typeof n !== 'number') return arr;
    return arr.slice(0, n);
  });

  // i18n helper: {{t "key"}} — looks up labels from context
  env.registerHelper('t', (key: string, options: Handlebars.HelperOptions) => {
    const labels = (options.data?.root as { labels?: Record<string, string> })?.labels;
    return labels?.[key] || key;
  });

  // Route helpers
  env.registerHelper('postUrl', (slug: string, options: Handlebars.HelperOptions) => {
    const routes = (options.data?.root as { routes?: { post?: string } })?.routes;
    const postPrefix = routes?.post ?? 'blog';
    return postPrefix === '' ? `/${slug}` : `/${postPrefix}/${slug}`;
  });

  env.registerHelper('blogUrl', (options: Handlebars.HelperOptions) => {
    const routes = (options.data?.root as { routes?: { blog?: string } })?.routes;
    const blogPrefix = routes?.blog || 'blog';
    return `/${blogPrefix}`;
  });

  env.registerHelper('categoryUrl', (slug: string, options: Handlebars.HelperOptions) => {
    const routes = (options.data?.root as { routes?: { category?: string } })?.routes;
    const categoryPrefix = routes?.category || 'category';
    return `/${categoryPrefix}/${slug}`;
  });

  env.registerHelper('tagUrl', (slug: string, options: Handlebars.HelperOptions) => {
    const routes = (options.data?.root as { routes?: { tag?: string } })?.routes;
    const tagPrefix = routes?.tag || 'tag';
    return `/${tagPrefix}/${slug}`;
  });

  env.registerHelper('authorUrl', (id: string, options: Handlebars.HelperOptions) => {
    const routes = (options.data?.root as { routes?: { author?: string } })?.routes;
    const authorPrefix = routes?.author || 'author';
    return `/${authorPrefix}/${id}`;
  });

  // SEO helpers
  env.registerHelper('absoluteUrl', (path: string, options: Handlebars.HelperOptions) => {
    if (!path) return path;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const root = options.data?.root as { site?: { url?: string } };
    const siteUrl = root?.site?.url || '';
    if (!siteUrl) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${siteUrl.replace(/\/$/, '')}${cleanPath}`;
  });

  env.registerHelper('isoDate', (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toISOString();
    } catch {
      return dateStr;
    }
  });

  env.registerHelper('jsonLdSafe', (obj: unknown) => {
    if (obj === null || obj === undefined) return 'null';
    try {
      // Escape HTML entities in JSON string to prevent XSS in script tags
      return JSON.stringify(obj, null, 2)
        .replace(/&/g, '\\u0026')
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e');
    } catch {
      return '{}';
    }
  });
}

export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https: data:; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'self'",
    },
  });
}

/**
 * Get list of available theme names.
 */
export function getAvailableThemes(): string[] {
  return AVAILABLE_THEMES;
}
