import { getAuthors, putAuthors } from '../../../src/services/meta.js';
import { requireAuth, jsonResponse, errorResponse } from '../../../src/utils/auth.js';
import type { Env, Author } from '../../../src/types.js';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const authors = await getAuthors(env.CONTENT_BUCKET, env.SITE_ID);
  return jsonResponse(authors);
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  let body: Partial<Author>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  if (!body.id || !body.name) {
    return errorResponse('Missing required fields: id, name');
  }

  const authors = await getAuthors(env.CONTENT_BUCKET, env.SITE_ID);
  if (authors.find((a) => a.id === body.id)) {
    return errorResponse(`Author "${body.id}" already exists`, 409);
  }

  authors.push({
    id: body.id,
    name: body.name,
    bio: body.bio,
    avatar: body.avatar,
    url: body.url,
    email: body.email,
    social: body.social,
    count: 0,
  });

  await putAuthors(env.CONTENT_BUCKET, env.SITE_ID, authors);
  return jsonResponse(authors, 201);
};

export const onRequestPut: PagesFunction<Env> = async ({ env, request }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  let body: Author[];
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body — expected array');
  }

  if (!Array.isArray(body)) {
    return errorResponse('Expected array of authors');
  }

  await putAuthors(env.CONTENT_BUCKET, env.SITE_ID, body);
  return jsonResponse(body);
};
