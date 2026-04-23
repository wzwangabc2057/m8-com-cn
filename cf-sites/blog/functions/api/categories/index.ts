import { getCategories, putCategories } from '../../../src/services/meta.js';
import { requireAuth, jsonResponse, errorResponse } from '../../../src/utils/auth.js';
import type { Env, Category } from '../../../src/types.js';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const categories = await getCategories(env.CONTENT_BUCKET, env.SITE_ID);
  return jsonResponse(categories);
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  let body: Partial<Category>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  if (!body.slug || !body.name) {
    return errorResponse('Missing required fields: slug, name');
  }

  const categories = await getCategories(env.CONTENT_BUCKET, env.SITE_ID);
  if (categories.find((c) => c.slug === body.slug)) {
    return errorResponse(`Category "${body.slug}" already exists`, 409);
  }

  categories.push({
    slug: body.slug,
    name: body.name,
    description: body.description || '',
    featuredImage: body.featuredImage,
    count: 0,
  });

  await putCategories(env.CONTENT_BUCKET, env.SITE_ID, categories);
  return jsonResponse(categories, 201);
};

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  let body: Category[];
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body — expected array');
  }

  if (!Array.isArray(body)) {
    return errorResponse('Expected array of categories');
  }

  await putCategories(env.CONTENT_BUCKET, env.SITE_ID, body);
  return jsonResponse(body);
};
