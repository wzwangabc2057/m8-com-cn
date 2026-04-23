import { getConfig, putConfig } from '../../src/services/content.js';
import { requireAuth, jsonResponse, errorResponse } from '../../src/utils/auth.js';
import type { Env, SiteConfig } from '../../src/types.js';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const config = await getConfig(env.CONTENT_BUCKET, env.SITE_ID);
  return jsonResponse(config);
};

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  let body: Partial<SiteConfig>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  // Merge with existing config
  let existing: SiteConfig;
  try {
    existing = await getConfig(env.CONTENT_BUCKET, env.SITE_ID);
  } catch {
    existing = {
      name: 'My Site',
      description: '',
      language: 'zh-CN',
      theme: 'default',
      url: '',
      postsPerPage: 10,
      nav: [],
    };
  }

  const updated: SiteConfig = { ...existing, ...body };
  await putConfig(env.CONTENT_BUCKET, env.SITE_ID, updated);
  return jsonResponse(updated);
};
