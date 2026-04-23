import type { Env } from '../types.js';

/**
 * Get the resolved Env (with correct SITE_ID from domain mapping).
 * Falls back to the original env if middleware hasn't run.
 */
export function getResolvedEnv(env: Env, data?: Record<string, unknown>): Env {
  if (data?.siteEnv) return data.siteEnv as Env;
  return env;
}

/**
 * Validate API key from Authorization header.
 * Returns null if valid, or a 401 Response if invalid.
 */
export function requireAuth(request: Request, env: Env): Response | null {
  const apiKey = env.API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const auth = request.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${apiKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null; // auth OK
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
