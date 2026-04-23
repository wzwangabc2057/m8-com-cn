-- Per-page custom JS asset URL (customCss already exists).
-- Run once: wrangler d1 execute cloudflare-sites-db --remote --file=shared/migrations/002_page_custom_assets.sql

ALTER TABLE posts ADD COLUMN customJs TEXT;
