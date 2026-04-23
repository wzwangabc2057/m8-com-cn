import { getTags, putTags } from '../../../src/services/meta.js';
import { requireAuth, jsonResponse, errorResponse } from '../../../src/utils/auth.js';
import type { Env, Tag } from '../../../src/types.js';

export const onRequestGet: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const slug = params.slug as string;
  const tags = await getTags(env.CONTENT_BUCKET, env.SITE_ID);
  const tag = tags.find((t) => t.slug === slug);
  if (!tag) return errorResponse('Tag not found', 404);

  return jsonResponse(tag);
};

export const onRequestPut: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const slug = params.slug as string;
  let body: Partial<Tag>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  const tags = await getTags(env.CONTENT_BUCKET, env.SITE_ID);
  const idx = tags.findIndex((t) => t.slug === slug);
  if (idx < 0) return errorResponse('Tag not found', 404);

  tags[idx] = {
    ...tags[idx],
    ...(body.name !== undefined && { name: body.name }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.featuredImage !== undefined && { featuredImage: body.featuredImage }),
  };

  await putTags(env.CONTENT_BUCKET, env.SITE_ID, tags);
  return jsonResponse(tags[idx]);
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const slug = params.slug as string;
  const tags = await getTags(env.CONTENT_BUCKET, env.SITE_ID);
  const idx = tags.findIndex((t) => t.slug === slug);
  if (idx < 0) return errorResponse('Tag not found', 404);

  tags.splice(idx, 1);
  await putTags(env.CONTENT_BUCKET, env.SITE_ID, tags);
  return jsonResponse({ deleted: slug });
};
