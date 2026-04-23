import Handlebars from 'handlebars';

/**
 * Register custom Handlebars helpers.
 */
export function registerHelpers(): void {
  // Format ISO date to readable string (locale from site.language, default en)
  Handlebars.registerHelper('formatDate', (dateStr: string, options: Handlebars.HelperOptions) => {
    if (!dateStr) return '';
    const lang = (options?.data?.root as { site?: { language?: string } })?.site?.language || 'en';
    const d = new Date(dateStr);
    try {
      return d.toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return d.toISOString().slice(0, 10);
    }
  });

  // Current year
  Handlebars.registerHelper('currentYear', () => new Date().getFullYear());

  // Equality check
  Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

  // Greater than
  Handlebars.registerHelper('gt', (a: number, b: number) => a > b);

  // Truncate text
  Handlebars.registerHelper('truncate', (str: string, len: number) => {
    if (!str) return '';
    if (typeof len !== 'number') len = 100;
    return str.length > len ? str.substring(0, len) + '...' : str;
  });

  // JSON stringify (for debugging)
  Handlebars.registerHelper('json', (context: unknown) => {
    return JSON.stringify(context, null, 2);
  });

  // Array length check
  Handlebars.registerHelper('hasItems', (arr: unknown[]) => {
    return Array.isArray(arr) && arr.length > 0;
  });

  // Logic helpers
  Handlebars.registerHelper('not', (a: unknown) => !a);
  Handlebars.registerHelper('or', (a: unknown, b: unknown) => a || b);
  Handlebars.registerHelper('and', (a: unknown, b: unknown) => a && b);
  Handlebars.registerHelper('fallback', (val: unknown, fb: unknown) => val || fb);

  // Array helpers
  Handlebars.registerHelper('first', (arr: unknown[]) => Array.isArray(arr) && arr.length > 0 ? arr[0] : '');
  Handlebars.registerHelper('take', (arr: unknown[], n: number) => {
    if (!Array.isArray(arr)) return [];
    if (typeof n !== 'number') return arr;
    return arr.slice(0, n);
  });

  // i18n helper: {{t "key"}} — looks up labels from context
  Handlebars.registerHelper('t', (key: string, options: Handlebars.HelperOptions) => {
    const labels = (options.data?.root as { labels?: Record<string, string> })?.labels;
    return labels?.[key] || key;
  });

  // Route helpers - generate URLs based on route mapping
  Handlebars.registerHelper('postUrl', (slug: string, options: Handlebars.HelperOptions) => {
    const routes = (options.data?.root as { routes?: { post?: string } })?.routes;
    const postPrefix = routes?.post ?? 'blog';
    return postPrefix === '' ? `/${slug}` : `/${postPrefix}/${slug}`;
  });

  // Image helper for Cloudflare Image Resizing
  Handlebars.registerHelper('cfImg', (url: string, width: number, options: Handlebars.HelperOptions) => {
    if (!url) return '';
    const root = options.data?.root as { site?: { imageResizing?: boolean } };
    const enabled = root?.site?.imageResizing === true;
    if (!enabled) return url;
    
    // Only process absolute paths starting with /site-assets/ or full URLs
    // Do not process relative paths or data URIs
    if (url.startsWith('data:')) return url;
    
    // Convert to /cdn-cgi/image/width={width},format=auto,quality=80/{url}
    return `/cdn-cgi/image/width=${width},format=auto,quality=80/${url.replace(/^\//, '')}`;
  });

  Handlebars.registerHelper('blogUrl', (options: Handlebars.HelperOptions) => {
    const routes = (options.data?.root as { routes?: { blog?: string } })?.routes;
    const blogPrefix = routes?.blog || 'blog';
    return `/${blogPrefix}`;
  });

  Handlebars.registerHelper('categoryUrl', (slug: string, options: Handlebars.HelperOptions) => {
    const routes = (options.data?.root as { routes?: { category?: string } })?.routes;
    const categoryPrefix = routes?.category || 'category';
    return `/${categoryPrefix}/${slug}`;
  });

  Handlebars.registerHelper('tagUrl', (slug: string, options: Handlebars.HelperOptions) => {
    const routes = (options.data?.root as { routes?: { tag?: string } })?.routes;
    const tagPrefix = routes?.tag || 'tag';
    return `/${tagPrefix}/${slug}`;
  });

  Handlebars.registerHelper('authorUrl', (id: string, options: Handlebars.HelperOptions) => {
    const routes = (options.data?.root as { routes?: { author?: string } })?.routes;
    const authorPrefix = routes?.author || 'author';
    return `/${authorPrefix}/${id}`;
  });

  // SEO helpers
  Handlebars.registerHelper('absoluteUrl', (path: string, options: Handlebars.HelperOptions) => {
    if (!path) return path;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const root = options.data?.root as { site?: { url?: string } };
    const siteUrl = root?.site?.url || '';
    if (!siteUrl) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${siteUrl.replace(/\/$/, '')}${cleanPath}`;
  });

  Handlebars.registerHelper('isoDate', (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toISOString();
    } catch {
      return dateStr;
    }
  });

  Handlebars.registerHelper('jsonLdSafe', (obj: unknown) => {
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
