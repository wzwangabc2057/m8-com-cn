-- Posts table: Stores metadata for listing and sorting
-- Content is still stored in R2, but metadata lives here for fast querying.
DROP TABLE IF EXISTS posts;
CREATE TABLE posts (
  siteId TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  coverImage TEXT,
  author TEXT,
  collection TEXT,
  publishedAt TEXT NOT NULL, -- ISO8601 string
  updatedAt TEXT,
  type TEXT DEFAULT 'post', -- 'post' or 'page'
  status TEXT DEFAULT 'published', -- 'published' or 'draft'
  seo TEXT, -- JSON string for SEO settings { title, description, canonical, ... }
  layout TEXT DEFAULT 'default',
  showTitle BOOLEAN DEFAULT 1,
  showHeader BOOLEAN DEFAULT 1,
  showFooter BOOLEAN DEFAULT 1,
  containerClass TEXT,
  customCss TEXT,
  customJs TEXT,
  PRIMARY KEY (siteId, slug)
);

-- Index for timeline queries (homepage)
CREATE INDEX IF NOT EXISTS idx_posts_date ON posts (siteId, publishedAt DESC);

-- Taxonomy table: Maps posts to tags and categories
-- Type: 'tag' or 'category'
DROP TABLE IF EXISTS post_taxonomies;
CREATE TABLE post_taxonomies (
  siteId TEXT NOT NULL,
  postSlug TEXT NOT NULL,
  type TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (siteId, postSlug, type, value)
);

-- Index for tag/category pages (e.g. /tag/javascript)
CREATE INDEX IF NOT EXISTS idx_taxonomies_lookup ON post_taxonomies (siteId, type, value);

-- Store content (banners, promos) for ecommerce storefront - managed by CMS
DROP TABLE IF EXISTS store_content;
CREATE TABLE store_content (
  siteId TEXT NOT NULL,
  id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'banner', -- 'banner' | 'promo'
  title TEXT NOT NULL,
  subtitle TEXT,
  link TEXT,
  imageUrl TEXT,
  startAt TEXT, -- ISO8601, optional
  endAt TEXT,   -- ISO8601, optional
  sortOrder INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active', -- 'active' | 'draft'
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  PRIMARY KEY (siteId, id)
);
CREATE INDEX IF NOT EXISTS idx_store_content_site_status ON store_content (siteId, status, sortOrder);

-- Site-level configuration (per site: store, etc.)
DROP TABLE IF EXISTS site_settings;
CREATE TABLE site_settings (
  siteId TEXT PRIMARY KEY,
  config TEXT NOT NULL, -- JSON: { store: { enabled, paymentMethods, medusaSalesChannelId }, ... }
  updatedAt TEXT NOT NULL
);

-- Platform-level configuration (global: Medusa connection, etc.; not per-site)
DROP TABLE IF EXISTS platform_settings;
CREATE TABLE platform_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config TEXT NOT NULL, -- JSON: { medusa: { adminApiToken?, backendUrl? }, ... }
  updatedAt TEXT NOT NULL
);
INSERT OR IGNORE INTO platform_settings (id, config, updatedAt) VALUES ('default', '{}', datetime('now'));

-- Writing task sync: site -> project mapping + job cursor
CREATE TABLE IF NOT EXISTS writing_sync (
  siteId TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  lastJobId TEXT,
  updatedAt TEXT NOT NULL
);
