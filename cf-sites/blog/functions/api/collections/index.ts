import { getCollections, putCollections } from '../../../src/services/meta.js';
import { requireAuth, jsonResponse, errorResponse } from '../../../src/utils/auth.js';
import type { Env, Collection } from '../../../src/types.js';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const collections = await getCollections(env.CONTENT_BUCKET, env.SITE_ID);
  return jsonResponse(collections);
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  let body: Partial<Collection>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  if (!body.key || !body.name) {
    return errorResponse('Missing required fields: key, name');
  }

  const collections = await getCollections(env.CONTENT_BUCKET, env.SITE_ID);
  if (collections.find((c) => c.key === body.key)) {
    return errorResponse(`Collection "${body.key}" already exists`, 409);
  }

  collections.push({
    key: body.key,
    name: body.name,
    description: body.description || '',
    coverImage: body.coverImage,
    order: body.order,
  });

  await putCollections(env.CONTENT_BUCKET, env.SITE_ID, collections);
  return jsonResponse(collections, 201);
};

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  let body: Collection[];
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body — expected array');
  }

  if (!Array.isArray(body)) {
    return errorResponse('Expected array of collections');
  }

  await putCollections(env.CONTENT_BUCKET, env.SITE_ID, body);
  return jsonResponse(body);
};
