/**
 * Platform (global) settings — not tied to any site.
 * Stored in D1 table platform_settings, separate from site_settings.
 */

export interface PlatformSettings {
  medusa?: {
    adminApiToken?: string;
    backendUrl?: string;
  };
  updatedAt: string;
}

const ROW_ID = 'default';

export async function getPlatformSettings(db: D1Database): Promise<PlatformSettings> {
  const { results } = await db
    .prepare('SELECT config, updatedAt FROM platform_settings WHERE id = ?')
    .bind(ROW_ID)
    .all();

  const row = (results || [])[0] as { config: string; updatedAt: string } | undefined;
  if (!row) {
    return { updatedAt: new Date().toISOString() };
  }

  try {
    const config = JSON.parse(row.config) as Record<string, unknown>;
    return {
      ...config,
      updatedAt: row.updatedAt,
    };
  } catch {
    return { updatedAt: row.updatedAt };
  }
}

export async function savePlatformSettings(
  db: D1Database,
  updates: Partial<PlatformSettings>
): Promise<void> {
  const current = await getPlatformSettings(db);
  const updatedAt = new Date().toISOString();
  const config = {
    medusa: updates.medusa !== undefined ? updates.medusa : current.medusa,
  };

  await db
    .prepare(
      `INSERT INTO platform_settings (id, config, updatedAt)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         config = excluded.config,
         updatedAt = excluded.updatedAt`
    )
    .bind(ROW_ID, JSON.stringify(config), updatedAt)
    .run();
}
