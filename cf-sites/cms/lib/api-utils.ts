import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export interface CloudflareEnv {
  CONTENT_BUCKET: R2Bucket;
  DB: D1Database;
  SITE_ID: string;
  API_KEY?: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  CF_WA_SITE_TAG?: string;
  CF_ZONE_ID?: string;
  CF_ZONE_API_TOKEN?: string;
  EVENTS_QUEUE?: Queue;
  MEDUSA_BACKEND_URL?: string;
  MEDUSA_ADMIN_API_TOKEN?: string;
  ARTICLE_WRITING_API_KEY?: string;
  ARTICLE_WRITING_SYSTEM_API_TOKEN?: string;
  CRON_SECRET?: string;
  GSC_SERVICE_ACCOUNT_JSON?: string;
}

export async function getEnv() {
  const ctx = getRequestContext();
  return ctx.env as CloudflareEnv;
}

export function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

// export function errorResponse(message: string, status = 400) {
//   return NextResponse.json({ error: message }, { status });
// }

export async function requireAuth(req: NextRequest) {
  const env = await getEnv();
  const authHeader = req.headers.get('Authorization');
  const apiKey = env.API_KEY;

  if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
    return false;
  }
  return true;
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
