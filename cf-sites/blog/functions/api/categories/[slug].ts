import { getCategories, putCategories } from '../../../src/services/meta.js';
import { requireAuth, jsonResponse, errorResponse } from '../../../src/utils/auth.js';
import type { Env, Category } from '../../../src/types.js';

export const onRequestGet: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const slug = params.slug as string;
  const categories = await getCategories(env.CONTENT_BUCKET, env.SITE_ID);
  const category = categories.find((c) => c.slug === slug);
  if (!category) return errorResponse('Category not found', 404);

  return jsonResponse(category);
};

export const onRequestPut: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const slug = params.slug as string;
  let body: Partial<Category>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  const categories = await getCategories(env.CONTENT_BUCKET, env.SITE_ID);
  const idx = categories.findIndex((c) => c.slug === slug);
  if (idx < 0) return errorResponse('Category not found', 404);

  // Merge update (preserve count, allow updating name/description/featuredImage)
  categories[idx] = {
    ...categories[idx],
    ...(body.name !== undefined && { name: body.name }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.featuredImage !== undefined && { featuredImage: body.featuredImage }),
  };

  await putCategories(env.CONTENT_BUCKET, env.SITE_ID, categories);
  return jsonResponse(categories[idx]);
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const slug = params.slug as string;
  const categories = await getCategories(env.CONTENT_BUCKET, env.SITE_ID);
  const idx = categories.findIndex((c) => c.slug === slug);
  if (idx < 0) return errorResponse('Category not found', 404);

  categories.splice(idx, 1);
  await putCategories(env.CONTENT_BUCKET, env.SITE_ID, categories);
  return jsonResponse({ deleted: slug });
};
