-- Platform (global) settings — separate from per-site site_settings.
-- Run once: wrangler d1 execute cloudflare-sites-db --remote --file=shared/migrations/001_platform_settings.sql

CREATE TABLE IF NOT EXISTS platform_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
INSERT OR IGNORE INTO platform_settings (id, config, updatedAt) VALUES ('default', '{}', datetime('now'));
