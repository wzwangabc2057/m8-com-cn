import { getPost } from '../../../src/services/content.js';
import { upsertPost, removePost } from '../../../src/services/indexing.js';
import { requireAuth, jsonResponse, errorResponse } from '../../../src/utils/auth.js';
import type { Env, Post } from '../../../src/types.js';

export const onRequestGet: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const slug = params.slug as string;
  const post = await getPost(env.CONTENT_BUCKET, env.SITE_ID, slug);
  if (!post) return errorResponse('Post not found', 404);

  return jsonResponse(post);
};

