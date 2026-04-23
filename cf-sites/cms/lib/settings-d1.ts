import { StoreConfig } from './types';

/** Default siteId used when no site is selected (e.g. Store config fallback). Site-level only. */
export const GLOBAL_SITE_ID = 'default';

export interface SiteSettings {
  store?: StoreConfig;
  siteId: string;
  updatedAt: string;
}

const DEFAULT_SETTINGS: SiteSettings = {
  siteId: GLOBAL_SITE_ID,
  updatedAt: new Date().toISOString(),
  store: {
    enabled: true,
    paymentMethods: {
      cod: { enabled: true, label: 'Cash on Delivery' },
    },
  },
};

export async function getSiteSettings(
  db: D1Database,
  siteId: string
): Promise<SiteSettings> {
  const { results } = await db
    .prepare('SELECT config, updatedAt FROM site_settings WHERE siteId = ?')
    .bind(siteId)
    .all();

  const row = (results || [])[0] as any;
  if (!row) return { ...DEFAULT_SETTINGS, siteId };

  try {
    const config = JSON.parse(row.config);
    return {
      ...config,
      siteId,
      updatedAt: row.updatedAt,
    };
  } catch {
    return { ...DEFAULT_SETTINGS, siteId };
  }
}

export async function saveSiteSettings(
  db: D1Database,
  siteId: string,
  settings: Partial<SiteSettings>
): Promise<void> {
  const current = await getSiteSettings(db, siteId);
  const newSettings = { ...current, ...settings, siteId, updatedAt: new Date().toISOString() };
  
  // Extract config object (everything except siteId and meta)
  const configToSave = {
    store: newSettings.store,
  };

  await db
    .prepare(
      `INSERT INTO site_settings (siteId, config, updatedAt)
       VALUES (?, ?, ?)
       ON CONFLICT(siteId) DO UPDATE SET
         config = excluded.config,
         updatedAt = excluded.updatedAt`
    )
    .bind(siteId, JSON.stringify(configToSave), newSettings.updatedAt)
    .run();
}
