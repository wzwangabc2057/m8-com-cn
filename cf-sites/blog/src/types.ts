// ─── Site Config ───────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];  // Dropdown sub-nav
}

export interface RouteMapping {
  blog?: string;      // default: 'blog'
  post?: string;      // default: 'blog'; set to '' for prefix-less URLs (/{slug})
  category?: string;  // default: 'category'
  tag?: string;       // default: 'tag'
  author?: string;    // default: 'author'
}

// ─── Header / Footer Config ────────────────────────────────

export interface SocialLink {
  platform: string;   // e.g. 'github', 'twitter', 'email'
  url: string;
  label?: string;
}

export interface HeaderConfig {
  logo?: string;           // Logo image URL
  logoText?: string;       // Logo text (overrides site.name in header)
  showNav?: boolean;       // Show navigation (default: true)
  sticky?: boolean;        // Sticky header (default: true)
  transparent?: boolean;   // Transparent header (for hero pages)
  customHtml?: boolean;    // Load custom header from R2 partials/header.html
}

export interface FooterConfig {
  copyright?: string;      // Custom copyright text (supports {{year}}, {{name}})
  showPoweredBy?: boolean; // Show "Powered by" (default: false)
  links?: NavItem[];       // Footer nav links (separate from header nav)
  social?: SocialLink[];   // Social media links
  customHtml?: boolean;    // Load custom footer from R2 partials/footer.html
}

// ─── Blog / Home / Defaults Config ──────────────────────────

/** Configuration for the blog listing page (/blog) */
export interface BlogConfig {
  title?: string;                // Custom title (default: collection name or 'Blog')
  description?: string;          // Custom description for the listing page
  coverImage?: string;           // Hero cover image for blog listing
  postsLayout?: 'grid' | 'list'; // Post layout mode (default: 'grid')
  featuredCount?: number;        // Number of featured posts on home (default: 3)
  showFeatured?: boolean;        // Show featured posts section on home (default: true)
}

/** Configuration for the home page */
export interface HomeConfig {
  title?: string;                // Custom home page title (default: site.name)
  subtitle?: string;             // Custom subtitle (default: site.description)
  heroImage?: string;            // Background image for hero section
  showCategories?: boolean;      // Show categories section (default: true)
  showTags?: boolean;            // Show tags cloud section (default: true)
  showStats?: boolean;           // Show stats in hero (default: true)
}

/** Default fallback images when content has no image set */
export interface DefaultImages {
  post?: string;                 // Default post cover image
  category?: string;             // Default category cover image
  tag?: string;                  // Default tag cover image
  collection?: string;           // Default collection cover image
  author?: string;               // Default author avatar
}

// ─── Page Attributes (per-page in _registry.json) ──────────

export type PageLayout =
  | 'default'       // Normal: container + title + content (default)
  | 'full_width'    // No container, no title — landing pages
  | 'wide'          // Wide container + title + content
  | 'withheader'    // Full width but with title/description block
  | 'sidebar'       // Content + sidebar
  | 'blank';        // No header/footer/container — raw HTML

export interface PageMeta {
  title: string;
  description?: string;

  // Layout & template
  layout?: PageLayout;        // Layout mode (default: 'default')
  template?: string;          // Custom template name — theme looks up page-{template}.html first
  showTitle?: boolean;        // Show page title (default: true for 'default' layout)
  showHeader?: boolean;       // Show site header (default: true, false only for 'blank')
  showFooter?: boolean;       // Show site footer (default: true, false only for 'blank')
  containerClass?: string;    // Extra CSS class on container

  // Hierarchy
  parent?: string;            // Parent page slug (for breadcrumbs)
  order?: number;             // Sort order (default: 0)

  // Media
  featuredImage?: string;     // Featured/hero image URL

  // SEO
  noindex?: boolean;          // Per-page noindex control

  // Per-page custom CSS (URL to a CSS file, served via /site-assets/...)
  customCss?: string;

  // Custom data (available in template as page.custom.*)
  custom?: Record<string, unknown>;
}

export type PageRegistry = Record<string, PageMeta>;

// ─── Site Config (full) ────────────────────────────────────

export interface SiteConfig {
  name: string;
  description: string;
  language: string;
  url: string;
  zoneId?: string; // Cloudflare Zone ID for analytics
  postsPerPage: number;
  theme: string;
  customCss?: string;
  customJs?: string;
  favicon?: string;
  nav: NavItem[];
  routes?: RouteMapping;
  header?: HeaderConfig;
  footer?: FooterConfig;
  social?: SocialLink[];    // Site-level social links
  blog?: BlogConfig;        // Blog listing page config
  home?: HomeConfig;        // Home page config
  imageResizing?: boolean;  // If true, uses Cloudflare Image Resizing (/cdn-cgi/image/...)
  defaults?: DefaultImages; // Default fallback images
  labels?: Record<string, string>; // Custom i18n label overrides (see Labels interface)
  contentSourceId?: string; // After site rename: original siteId whose R2 folder still holds content
  disabled?: boolean; // When true, site returns 503 and is hidden from CMS switcher
  seo?: {
    titleSeparator?: string;    // default: ' - '
    defaultOgImage?: string;    // fallback OG image
    twitterHandle?: string;     // e.g. '@mysite'
    googleVerification?: string;
    bingVerification?: string;
    robotsExtra?: string;       // Additional robots.txt rules
  };
  /** Reverse proxy: pathPrefix -> target. Single object or array for multiple rules. */
  proxy?: { pathPrefix: string; target: string } | Array<{ pathPrefix: string; target: string }>;
  /** Exact-path redirects, typically used for slug renames. */
  redirects?: Array<{ from: string; to: string; status?: 301 | 302 }>;
}

// ─── Post ──────────────────────────────────────────────────

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
  status?: 'published' | 'draft' | 'archived';
  seo?: SeoConfig;
  // Page attributes
  layout?: PageLayout;
  showTitle?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
  containerClass?: string;
}

export interface Post extends PostSummary {
  updatedAt: string;
  content: string; // HTML
}

// ─── Post Index (sharded) ──────────────────────────────────

/** Stored in posts/_index.json — metadata only, no post list */
export interface PostIndexMeta {
  total: number;
  shardSize: number;       // Max posts per shard file (default: 500)
  shardCount: number;      // Number of shard files
  lastUpdated: string;     // ISO date
}

/** Default shard size */
export const DEFAULT_SHARD_SIZE = 500;

// ─── Page Entry (runtime, returned by getPage) ─────────────

export interface PageEntry {
  title: string;
  description: string;
  content: string;           // HTML body
  layout: PageLayout;
  template?: string;
  showTitle: boolean;
  showHeader: boolean;
  showFooter: boolean;
  containerClass?: string;
  parent?: string;
  order: number;
  featuredImage?: string;
  noindex?: boolean;
  seo?: SeoConfig;          // Per-page SEO (title, description) for pageTitle / pageDescription
  customCss?: string;        // Per-page custom CSS URL (e.g. /site-assets/2026/02/page-home.css)
  customJs?: string;         // Per-page custom JS URL (e.g. /site-assets/2026/02/page-home.js)
  custom?: Record<string, unknown>;
}

// ─── Meta ──────────────────────────────────────────────────

export interface Category {
  slug: string;
  name: string;
  description: string;
  featuredImage?: string;  // Category cover/featured image
  count: number;
}

export interface Tag {
  slug: string;
  name: string;
  description?: string;
  featuredImage?: string;  // Tag cover/featured image
  count: number;
}

export interface Author {
  id: string;
  name: string;
  bio?: string;
  avatar?: string;
  url?: string;
  email?: string;
  social?: SocialLink[];
  count: number;
}

export interface Collection {
  key: string;
  name: string;
  description: string;
  coverImage?: string;
  order?: number;
}

// ─── Pagination ────────────────────────────────────────────

export interface PaginationInfo {
  current: number;
  totalPages: number;
  total: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextUrl: string | null;
  prevUrl: string | null;
}

export interface PaginatedPosts {
  posts: PostSummary[];
  pagination: PaginationInfo;
}

// ─── Env bindings (CF Pages Functions) ─────────────────────

// R2Bucket is provided by @cloudflare/workers-types at runtime.
// This declaration ensures tools that import from types.ts don't error.
declare global {
  interface R2Bucket {}
  interface D1Database {}
  interface KVNamespace {}
  interface AnalyticsEngineDataset {
    writeDataPoint(event: {
      blobs?: string[];
      doubles?: number[];
      indexes?: string[];
    }): void;
  }
}

export interface Env {
  CONTENT_BUCKET: R2Bucket;
  DB: D1Database;
  SITE_ID: string;
  API_KEY?: string;
  CACHE?: KVNamespace;
  ANALYTICS?: AnalyticsEngineDataset;
  /** When behind Router Worker: origin from X-Forwarded-Host/Proto. Used for canonical to match actual URL. */
  EFFECTIVE_ORIGIN?: string;
  /** After site rename: original siteId whose R2 folder still holds content. */
  CONTENT_SOURCE_ID?: string;
}

// ─── SEO ───────────────────────────────────────────────────

export interface SeoMeta {
  canonicalUrl: string;
  ogType: 'website' | 'article';
  ogImage?: string;
  articlePublishedTime?: string;
  articleModifiedTime?: string;
  articleAuthor?: string;
  articleTags?: string[];
  articleSection?: string;  // category
  noindex?: boolean;        // per-page noindex control
  prevUrl?: string;         // rel="prev" for paginated pages
  nextUrl?: string;         // rel="next" for paginated pages
}

// ─── Render context ────────────────────────────────────────

export interface RenderContext {
  site: SiteConfig;
  pageTitle: string;
  pageDescription?: string;
  seo?: SeoMeta;
  [key: string]: unknown;
}
