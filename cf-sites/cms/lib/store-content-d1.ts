import type { StoreContent } from './types';

export async function listStoreContent(
  db: D1Database,
  siteId: string,
  options?: { status?: string }
): Promise<StoreContent[]> {
  let query = 'SELECT * FROM store_content WHERE siteId = ?';
  const params: (string | number)[] = [siteId];
  if (options?.status) {
    query += ' AND status = ?';
    params.push(options.status);
  }
  query += ' ORDER BY sortOrder ASC, updatedAt DESC';

  const { results } = await db.prepare(query).bind(...params).all();
  return (results || []).map((row: any) => ({
    id: row.id,
    type: row.type || 'banner',
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    link: row.link ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    startAt: row.startAt ?? undefined,
    endAt: row.endAt ?? undefined,
    sortOrder: row.sortOrder ?? 0,
    status: row.status || 'active',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function getStoreContentById(
  db: D1Database,
  siteId: string,
  id: string
): Promise<StoreContent | null> {
  const { results } = await db
    .prepare('SELECT * FROM store_content WHERE siteId = ? AND id = ?')
    .bind(siteId, id)
    .all();
  const row = (results || [])[0] as any;
  if (!row) return null;
  return {
    id: row.id,
    type: row.type || 'banner',
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    link: row.link ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    startAt: row.startAt ?? undefined,
    endAt: row.endAt ?? undefined,
    sortOrder: row.sortOrder ?? 0,
    status: row.status || 'active',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function saveStoreContent(
  db: D1Database,
  siteId: string,
  data: StoreContent
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO store_content (siteId, id, type, title, subtitle, link, imageUrl, startAt, endAt, sortOrder, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(siteId, id) DO UPDATE SET
         type = excluded.type,
         title = excluded.title,
         subtitle = excluded.subtitle,
         link = excluded.link,
         imageUrl = excluded.imageUrl,
         startAt = excluded.startAt,
         endAt = excluded.endAt,
         sortOrder = excluded.sortOrder,
         status = excluded.status,
         updatedAt = excluded.updatedAt`
    )
    .bind(
      siteId,
      data.id,
      data.type,
      data.title,
      data.subtitle ?? null,
      data.link ?? null,
      data.imageUrl ?? null,
      data.startAt ?? null,
      data.endAt ?? null,
      data.sortOrder ?? 0,
      data.status ?? 'active',
      data.createdAt || now,
      now
    )
    .run();
}

export async function deleteStoreContent(
  db: D1Database,
  siteId: string,
  id: string
): Promise<void> {
  await db.prepare('DELETE FROM store_content WHERE siteId = ? AND id = ?').bind(siteId, id).run();
}
