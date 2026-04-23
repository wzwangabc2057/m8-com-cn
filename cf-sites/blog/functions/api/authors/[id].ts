import { getAuthors, putAuthors } from '../../../src/services/meta.js';
import { requireAuth, jsonResponse, errorResponse } from '../../../src/utils/auth.js';
import type { Env, Author } from '../../../src/types.js';

export const onRequestGet: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const id = params.id as string;
  const authors = await getAuthors(env.CONTENT_BUCKET, env.SITE_ID);
  const author = authors.find((a) => a.id === id);
  if (!author) return errorResponse('Author not found', 404);

  return jsonResponse(author);
};

export const onRequestPut: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const id = params.id as string;
  let body: Partial<Author>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  const authors = await getAuthors(env.CONTENT_BUCKET, env.SITE_ID);
  const idx = authors.findIndex((a) => a.id === id);
  if (idx < 0) return errorResponse('Author not found', 404);

  // Merge update (preserve count)
  authors[idx] = {
    ...authors[idx],
    ...(body.name !== undefined && { name: body.name }),
    ...(body.bio !== undefined && { bio: body.bio }),
    ...(body.avatar !== undefined && { avatar: body.avatar }),
    ...(body.url !== undefined && { url: body.url }),
    ...(body.email !== undefined && { email: body.email }),
    ...(body.social !== undefined && { social: body.social }),
  };

  await putAuthors(env.CONTENT_BUCKET, env.SITE_ID, authors);
  return jsonResponse(authors[idx]);
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, request, params }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const id = params.id as string;
  const authors = await getAuthors(env.CONTENT_BUCKET, env.SITE_ID);
  const idx = authors.findIndex((a) => a.id === id);
  if (idx < 0) return errorResponse('Author not found', 404);

  authors.splice(idx, 1);
  await putAuthors(env.CONTENT_BUCKET, env.SITE_ID, authors);
  return jsonResponse({ deleted: id });
};
