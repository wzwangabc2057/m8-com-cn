/**
 * Scheduled Publish Cron Worker
 *
 * 每天 8:00 UTC 调用 CMS 的 /api/cron/scheduled-publish，
 * 按各站点配置的「每日自动发布篇数」将草稿转为已发布。
 * 认证：X-Cron-Secret 需与 CMS 的 CRON_SECRET 一致。
 */

interface Env {
  CMS_URL: string;
  CRON_SECRET: string;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const url = `${env.CMS_URL.replace(/\/$/, '')}/api/cron/scheduled-publish`;
    const startedAt = Date.now();
    console.log(`[scheduled-publish-cron] Running at ${new Date().toISOString()}, calling ${url}`);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Cron-Secret': env.CRON_SECRET,
        },
      });
      const body = await res.text();
      const elapsed = Date.now() - startedAt;
      if (!res.ok) {
        console.error(`[scheduled-publish-cron] Failed: ${res.status} (${elapsed}ms)`, body?.slice(0, 300));
      } else {
        console.log(`[scheduled-publish-cron] Ok: ${res.status} (${elapsed}ms)`, body?.slice(0, 500));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[scheduled-publish-cron] Error:`, msg);
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', service: 'scheduled-publish-cron' });
    }
    if (url.pathname === '/trigger' && request.method === 'POST') {
      const secret = request.headers.get('X-Cron-Secret');
      if (secret !== env.CRON_SECRET) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const publishUrl = `${env.CMS_URL.replace(/\/$/, '')}/api/cron/scheduled-publish`;
      const res = await fetch(publishUrl, {
        method: 'GET',
        headers: { 'X-Cron-Secret': env.CRON_SECRET },
      });
      const body = await res.text();
      return new Response(
        JSON.stringify({ status: res.status, body: body?.slice(0, 2000) }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response('Scheduled Publish Cron Worker', { status: 200 });
  },
};
