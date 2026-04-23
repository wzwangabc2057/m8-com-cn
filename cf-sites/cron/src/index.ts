/**
 * Writing Sync Cron Worker
 *
 * Triggers POST /api/cron/sync-writing-tasks on the CMS periodically.
 * Auth: X-Cron-Secret header (must match CRON_SECRET in CMS).
 */

interface Env {
  CMS_URL: string;
  CRON_SECRET: string;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const url = `${env.CMS_URL.replace(/\/$/, '')}/api/cron/sync-writing-tasks`;
    const startedAt = Date.now();
    console.log(`[cron] Sync started at ${new Date().toISOString()}, calling ${url}`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Cron-Secret': env.CRON_SECRET,
          'Content-Type': 'application/json',
        },
      });
      const body = await res.text();
      const elapsed = Date.now() - startedAt;
      if (!res.ok) {
        console.error(`[cron] Sync failed: ${res.status} ${res.statusText} (${elapsed}ms)`, body?.slice(0, 200));
      } else {
        console.log(`[cron] Sync ok: ${res.status} (${elapsed}ms)`, body?.slice(0, 500));
      }
    } catch (err: any) {
      console.error(`[cron] Sync error:`, err?.message);
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', service: 'writing-sync-cron' });
    }
    if (url.pathname === '/trigger' && request.method === 'POST') {
      const secret = request.headers.get('X-Cron-Secret');
      if (secret !== env.CRON_SECRET) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const syncUrl = `${env.CMS_URL.replace(/\/$/, '')}/api/cron/sync-writing-tasks`;
      const res = await fetch(syncUrl, {
        method: 'POST',
        headers: { 'X-Cron-Secret': env.CRON_SECRET, 'Content-Type': 'application/json' },
      });
      const body = await res.text();
      return new Response(
        JSON.stringify({ status: res.status, body: body?.slice(0, 1000) }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response('Writing Sync Cron Worker', { status: 200 });
  },
};
