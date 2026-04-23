import { getCollections, putCollections } from '../../../src/services/meta.js';
import { requireAuth, jsonResponse, errorResponse } from '../../../src/utils/auth.js';
import type { Env, Collection } from '../../../src/types.js';

export const onRequestGet: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const key = params.key as string;
  const collections = await getCollections(env.CONTENT_BUCKET, env.SITE_ID);
  const collection = collections.find((c) => c.key === key);
  if (!collection) return errorResponse('Collection not found', 404);

  return jsonResponse(collection);
};

export const onRequestPut: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const key = params.key as string;
  let body: Partial<Collection>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  const collections = await getCollections(env.CONTENT_BUCKET, env.SITE_ID);
  const idx = collections.findIndex((c) => c.key === key);
  if (idx < 0) return errorResponse('Collection not found', 404);

  collections[idx] = {
    ...collections[idx],
    ...(body.name !== undefined && { name: body.name }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.coverImage !== undefined && { coverImage: body.coverImage }),
    ...(body.order !== undefined && { order: body.order }),
  };

  await putCollections(env.CONTENT_BUCKET, env.SITE_ID, collections);
  return jsonResponse(collections[idx]);
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const key = params.key as string;
  const collections = await getCollections(env.CONTENT_BUCKET, env.SITE_ID);
  const idx = collections.findIndex((c) => c.key === key);
  if (idx < 0) return errorResponse('Collection not found', 404);

  collections.splice(idx, 1);
  await putCollections(env.CONTENT_BUCKET, env.SITE_ID, collections);
  return jsonResponse({ deleted: key });
};
