import { getConfig, getPost, getPostsFromShards, getFeed } from '../../../src/services/content.js';
import { upsertPost } from '../../../src/services/indexing.js';
import { requireAuth, jsonResponse, errorResponse } from '../../../src/utils/auth.js';
import type { Env, Post } from '../../../src/types.js';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
  const category = url.searchParams.get('category');
  const tag = url.searchParams.get('tag');
  const author = url.searchParams.get('author');
  const collection = url.searchParams.get('collection');

  // If filtering, use feed files (fast); otherwise use shards
  if (category) {
    const feedPosts = await getFeed(env.CONTENT_BUCKET, env.SITE_ID, `category/${category}`);
    return paginateAndReturn(feedPosts, page, pageSize);
  }
  if (tag) {
    const feedPosts = await getFeed(env.CONTENT_BUCKET, env.SITE_ID, `tag/${tag}`);
    return paginateAndReturn(feedPosts, page, pageSize);
  }
  if (author) {
    const feedPosts = await getFeed(env.CONTENT_BUCKET, env.SITE_ID, `author/${author}`);
    return paginateAndReturn(feedPosts, page, pageSize);
  }
  if (collection) {
    const feedPosts = await getFeed(env.CONTENT_BUCKET, env.SITE_ID, `collection/${collection}`);
    return paginateAndReturn(feedPosts, page, pageSize);
  }

  // No filter — use sharded index
  const { posts, total } = await getPostsFromShards(env.CONTENT_BUCKET, env.SITE_ID, page, pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return jsonResponse({ total, totalPages, page, pageSize, posts });
};

function paginateAndReturn(allPosts: any[], page: number, pageSize: number) {
  const total = allPosts.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const posts = allPosts.slice(start, start + pageSize);
  return jsonResponse({ total, totalPages, page, pageSize, posts });
}

