// ─── Navigation ─────────────────────────────────────────────
export interface NavItem {
  label: string;
  href: string;
}

// ─── Site Config ────────────────────────────────────────────
export interface SiteConfig {
  name: string;
  /** CMS-only: display name for site switcher/list (e.g. "AI Football Test") */
  displayName?: string;
  description: string;
  language: string;
  url?: string;
  zoneId?: string;
  /** After site rename: original siteId whose R2 folder still holds content */
  contentSourceId?: string;
  /** When true, site is offline: blog returns 503, site hidden from CMS switcher */
  disabled?: boolean;
  /** When false, writing sync (cron) will skip this site. Default true for backwards compat. */
  writingSyncEnabled?: boolean;
  postsPerPage: number;
  theme?: string;
  customCss?: string;
  customJs?: string;
  imageResizing?: boolean;
  favicon?: string;
  nav: NavItem[];
  seo?: {
    titleSeparator?: string;
    defaultOgImage?: string;
    twitterHandle?: string;
    googleVerification?: string;
    bingVerification?: string;
    robotsExtra?: string;
  };
  /** Reverse proxy: pathPrefix -> target. Single object or array for multiple rules. */
  proxy?: { pathPrefix: string; target: string } | Array<{ pathPrefix: string; target: string }>;
  /** Exact-path redirects, typically used for slug renames. */
  redirects?: Array<{ from: string; to: string; status?: 301 | 302 }>;
  medusa?: {
    adminApiToken?: string;
    backendUrl?: string;
  };
  [key: string]: any; // Allow additional dynamic fields
}

// ─── Posts & Pages ──────────────────────────────────────────
export type PageLayout = 'default' | 'full-width' | 'landing' | 'blank';

export interface SeoConfig {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
}

export interface PostSummary {
  slug: string;
  title: string;
  excerpt: string;
  coverImage?: string;
  author: string;
  categories: string[];
  tags: string[];
  collection: string;
  publishedAt: string;
  type?: 'post' | 'page';
  /** published=前台展示；draft=草稿可被定时发布；archived=已归档/真下线，不展示且不会被定时发布 */
  status?: 'published' | 'draft' | 'archived';
  seo?: SeoConfig;
  layout?: PageLayout;
  showTitle?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
  containerClass?: string;
}

export interface Post extends PostSummary {
  updatedAt: string;
  content: string;
}

export interface PostIndexMeta {
  total: number;
  shardSize: number;
  shardCount: number;
  lastUpdated: string;
}

// ─── Store content (banners, promos) for ecommerce storefront ───
export type StoreContentType = 'banner' | 'promo';
export type StoreContentStatus = 'active' | 'draft';

export interface StoreContent {
  id: string;
  type: StoreContentType;
  title: string;
  subtitle?: string;
  link?: string;
  imageUrl?: string;
  startAt?: string;
  endAt?: string;
  sortOrder: number;
  status: StoreContentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StoreConfig {
  enabled: boolean;
  /** Medusa sales channel ID for this site (admin filtering). */
  medusaSalesChannelId?: string;
  /** Publishable API Key (pk_...) for storefront; scoped to this site's sales channel in Medusa. */
  medusaPublishableKey?: string;
  paymentMethods: {
    cod?: { enabled: boolean; label?: string };
    stripe?: { enabled: boolean; publishableKey?: string };
  };
  checkout?: {
    guestCheckout: boolean;
  };
}
