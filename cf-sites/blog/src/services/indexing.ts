/**
 * High-level indexing service.
 * Coordinates shards, feeds, and meta updates on post changes.
 */

import type { Post, PostSummary } from '../types.js';
import {
  putPost, deletePostFile, postToSummary,
  loadAllShards, writeShards,
  getFeed, putFeed,
} from './content.js';
import { updateMetaIncremental, rebuildMetaFromPosts } from './meta.js';

// ─── Feed Keys ─────────────────────────────────────────────

function getFeedKeys(post: PostSummary): string[] {
  const keys: string[] = [];
  for (const cat of post.categories) keys.push(`category/${cat}`);
  for (const tag of post.tags) keys.push(`tag/${tag}`);
  keys.push(`author/${post.author}`);
  if (post.collection) keys.push(`collection/${post.collection}`);
  return keys;
}

// ─── Upsert Post ───────────────────────────────────────────

/**
 * Create or update a post: saves the post file, updates shards, feeds, and meta.
 * @param oldPost - The post before the change (null = new post)
 */
export async function upsertPost(
  bucket: R2Bucket,
  siteId: string,
  post: Post,
  oldPost: Post | null,
): Promise<void> {
  const newSummary = postToSummary(post);
  const oldSummary = oldPost ? postToSummary(oldPost) : null;

  // 1. Save individual post file
  await putPost(bucket, siteId, post);

  // 2. Update sharded index
  const allPosts = await loadAllShards(bucket, siteId);
  const idx = allPosts.findIndex((p) => p.slug === post.slug);
  if (idx >= 0) {
    allPosts.splice(idx, 1);
  }
  allPosts.push(newSummary);
  allPosts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  await writeShards(bucket, siteId, allPosts);

  // 3. Update feed files (parallel)
  await updateFeedsForPost(bucket, siteId, oldSummary, newSummary);

  // 4. Incremental meta update (parallel)
  await updateMetaIncremental(bucket, siteId, oldSummary, newSummary);
}

// ─── Remove Post ───────────────────────────────────────────

/**
 * Delete a post: removes the post file, updates shards, feeds, and meta.
 */
export async function removePost(
  bucket: R2Bucket,
  siteId: string,
  existingPost: Post,
): Promise<void> {
  const oldSummary = postToSummary(existingPost);

  // 1. Delete post file
  await deletePostFile(bucket, siteId, existingPost.slug);

  // 2. Update sharded index
  const allPosts = await loadAllShards(bucket, siteId);
  const filtered = allPosts.filter((p) => p.slug !== existingPost.slug);
  await writeShards(bucket, siteId, filtered);

  // 3. Remove from feed files
  await updateFeedsForPost(bucket, siteId, oldSummary, null);

  // 4. Incremental meta update
  await updateMetaIncremental(bucket, siteId, oldSummary, null);
}

// ─── Feed Update ───────────────────────────────────────────

/**
 * Incrementally update feed files based on a post change.
 * Loads each affected feed, modifies it, writes back.
 */
async function updateFeedsForPost(
  bucket: R2Bucket,
  siteId: string,
  oldPost: PostSummary | null,
  newPost: PostSummary | null,
): Promise<void> {
  // Determine all affected feed keys
  const oldKeys = new Set(oldPost ? getFeedKeys(oldPost) : []);
  const newKeys = new Set(newPost ? getFeedKeys(newPost) : []);
  const allKeys = new Set([...oldKeys, ...newKeys]);

  await Promise.all([...allKeys].map(async (feedKey) => {
    let feed = await getFeed(bucket, siteId, feedKey);

    // Remove old entry
    if (oldKeys.has(feedKey) && oldPost) {
      feed = feed.filter((p) => p.slug !== oldPost.slug);
    }

    // Add or update new entry
    if (newKeys.has(feedKey) && newPost) {
      const existing = feed.findIndex((p) => p.slug === newPost.slug);
      if (existing >= 0) {
        feed[existing] = newPost;
      } else {
        feed.push(newPost);
      }
    }

    // Sort by publishedAt desc
    feed.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    await putFeed(bucket, siteId, feedKey, feed);
  }));
}

// ─── Full Rebuild ──────────────────────────────────────────

/**
 * Rebuild everything from scratch: shards, all feeds, all meta.
 * Reads all individual post files from R2.
 */
export async function rebuildAll(
  bucket: R2Bucket,
  siteId: string,
): Promise<{ total: number; feeds: number }> {
  // 1. List all post files from R2
  const allPosts = await loadAllPostFiles(bucket, siteId);

  // Sort by publishedAt desc
  allPosts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const summaries = allPosts.map(postToSummary);

  // 2. Write shards
  await writeShards(bucket, siteId, summaries);

  // 3. Build and write all feed files
  const feedCount = await rebuildAllFeeds(bucket, siteId, summaries);

  // 4. Rebuild meta
  await rebuildMetaFromPosts(bucket, siteId, summaries);

  return { total: summaries.length, feeds: feedCount };
}

/**
 * Load all individual post JSON files from R2.
 */
async function loadAllPostFiles(bucket: R2Bucket, siteId: string): Promise<Post[]> {
  const listPrefix = `sites/${siteId}/posts/`;
  const posts: Post[] = [];

  let cursor: string | undefined;
  do {
    const listed = await (bucket as any).list({ prefix: listPrefix, cursor });
    for (const obj of listed.objects) {
      // Skip index and shard files
      const key = obj.key;
      const filename = key.slice(listPrefix.length);
      if (filename.startsWith('_')) continue;
      if (!filename.endsWith('.json')) continue;

      const data = await bucket.get(key);
      if (data) {
        try {
          const post = await (data as any).json() as Post;
          if (post.slug && post.title) {
            posts.push(post);
          }
        } catch {
          // Skip invalid files
        }
      }
    }
    cursor = listed.truncated ? (listed as any).cursor : undefined;
  } while (cursor);

  return posts;
}

/**
 * Rebuild all feed files from a complete post list.
 */
async function rebuildAllFeeds(
  bucket: R2Bucket,
  siteId: string,
  allPosts: PostSummary[],
): Promise<number> {
  // Collect all feed groups
  const feeds = new Map<string, PostSummary[]>();

  for (const post of allPosts) {
    for (const cat of post.categories) {
      const key = `category/${cat}`;
      if (!feeds.has(key)) feeds.set(key, []);
      feeds.get(key)!.push(post);
    }
    for (const tag of post.tags) {
      const key = `tag/${tag}`;
      if (!feeds.has(key)) feeds.set(key, []);
      feeds.get(key)!.push(post);
    }
    const authorKey = `author/${post.author}`;
    if (!feeds.has(authorKey)) feeds.set(authorKey, []);
    feeds.get(authorKey)!.push(post);

    if (post.collection) {
      const collKey = `collection/${post.collection}`;
      if (!feeds.has(collKey)) feeds.set(collKey, []);
      feeds.get(collKey)!.push(post);
    }
  }

  // Write all feeds in parallel
  await Promise.all(
    [...feeds.entries()].map(([feedKey, posts]) => putFeed(bucket, siteId, feedKey, posts)),
  );

  return feeds.size;
}
