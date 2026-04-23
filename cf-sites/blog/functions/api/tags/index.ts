import { getTags, putTags } from '../../../src/services/meta.js';
import { requireAuth, jsonResponse, errorResponse } from '../../../src/utils/auth.js';
import type { Env, Tag } from '../../../src/types.js';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const tags = await getTags(env.CONTENT_BUCKET, env.SITE_ID);
  return jsonResponse(tags);
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  let body: Partial<Tag>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  if (!body.slug || !body.name) {
    return errorResponse('Missing required fields: slug, name');
  }

  const tags = await getTags(env.CONTENT_BUCKET, env.SITE_ID);
  if (tags.find((t) => t.slug === body.slug)) {
    return errorResponse(`Tag "${body.slug}" already exists`, 409);
  }

  tags.push({
    slug: body.slug,
    name: body.name,
    description: body.description,
    featuredImage: body.featuredImage,
    count: 0,
  });

  await putTags(env.CONTENT_BUCKET, env.SITE_ID, tags);
  return jsonResponse(tags, 201);
};

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  let body: Tag[];
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body — expected array');
  }

  if (!Array.isArray(body)) {
    return errorResponse('Expected array of tags');
  }

  await putTags(env.CONTENT_BUCKET, env.SITE_ID, body);
  return jsonResponse(body);
};
