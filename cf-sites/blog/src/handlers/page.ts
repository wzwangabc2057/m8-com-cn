import { getConfig, getPage, applyImageResizing } from '../services/content.js';
import { loadCustomPartials } from '../services/partials.js';
import { getStoreEnabled } from '../services/kv-cache.js';
import { render, htmlResponse } from '../renderer.js';
import { handleHome } from './home.js';
import {
  buildPageSeo,
  buildWebSiteSchema,
  buildBreadcrumbSchema,
  getCanonicalBase,
} from '../utils/seo.js';
import type { Env } from '../types.js';

export async function handlePage(env: Env, slug: string): Promise<Response | null> {
  if (slug === 'index' && env.SITE_ID === 'm8.com.cn') {
    return handleHome(env, 1);
  }

  const [config, pageEntry, storeEnabled] = await Promise.all([
    getConfig(env.CONTENT_BUCKET, env.SITE_ID, env.CACHE),
    getPage(env.DB, env.CONTENT_BUCKET, env.SITE_ID, slug, env.CONTENT_SOURCE_ID),
    getStoreEnabled(env.CACHE),
  ]);

  if (!pageEntry) return null;

  const customPartials = await loadCustomPartials(env.CONTENT_BUCKET, env.SITE_ID, config, env.CONTENT_SOURCE_ID);

  // Template hierarchy: page-{template} > page-{slug} > page
  const templateName = pageEntry.template
    ? `page-${pageEntry.template}`
    : `page-${slug}`;

  const fullWidth = pageEntry.layout === 'full_width'
    || pageEntry.layout === 'wide'
    || pageEntry.layout === 'withheader'
    || pageEntry.layout === 'blank';

  // Special handling for index page: canonical URL should be '/' not '/index'
  const canonicalSlug = slug === 'index' ? '' : slug;
  const seo = buildPageSeo(config, pageEntry, canonicalSlug, env.EFFECTIVE_ORIGIN);

  const base = getCanonicalBase(config, env.EFFECTIVE_ORIGIN);
  const schema: Record<string, unknown> = {
    website: buildWebSiteSchema(config, base),
  };
  if (pageEntry.parent) {
    const breadcrumbs = [
      { name: config.name, url: '/' },
      { name: pageEntry.title, url: `/${slug}` },
    ];
    schema.breadcrumbList = buildBreadcrumbSchema(config, breadcrumbs, base);
  }

  if (pageEntry.content) {
    if (pageEntry.showTitle) {
      // Downgrade any <h1> to <h2> in the content, since the page template provides its own <h1>
      pageEntry.content = pageEntry.content.replace(/<h1/gi, '<h2').replace(/<\/h1>/gi, '</h2>');
    }
    // Apply CF Image Resizing to content images (src + srcset) when enabled
    pageEntry.content = applyImageResizing(pageEntry.content, config.imageResizing === true);
  }

  const html = render(config.theme || 'default', templateName, {
    site: { ...config, url: env.EFFECTIVE_ORIGIN || config.url },
    storeEnabled,
    pageTitle: pageEntry.seo?.title || pageEntry.title,
    hasCustomTitle: !!pageEntry.seo?.title,
    pageDescription: pageEntry.seo?.description || pageEntry.description || config.description,
    seo,
    schema,
    page: pageEntry,
    layout: pageEntry.layout,
    fullWidth,
    showTitle: pageEntry.showTitle,
    handler: slug === 'index' ? 'home' : 'page',
    showHeader: pageEntry.showHeader,
    showFooter: pageEntry.showFooter,
    pageCss: pageEntry.customCss || null,
    pageJs: pageEntry.customJs || null,
    customPartials,
    preloadImage: pageEntry.featuredImage || seo.ogImage,
  }, 'page');

  return htmlResponse(html);
}
