import type { Category, Tag, Author, Collection, PostSummary, SocialLink } from '../types.js';

function prefix(siteId: string, path: string): string {
  return `sites/${siteId}/${path}`;
}

// ─── Generic JSON read/write ───────────────────────────────

async function getJson<T>(bucket: R2Bucket, key: string, fallback: T): Promise<T> {
  const obj = await bucket.get(key);
  if (!obj) return fallback;
  return obj.json<T>();
}

async function putJson<T>(bucket: R2Bucket, key: string, data: T): Promise<void> {
  await bucket.put(key, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

// ─── Categories ────────────────────────────────────────────

export async function getCategories(bucket: R2Bucket, siteId: string): Promise<Category[]> {
  return getJson<Category[]>(bucket, prefix(siteId, 'meta/categories.json'), []);
}

export async function putCategories(bucket: R2Bucket, siteId: string, categories: Category[]): Promise<void> {
  await putJson(bucket, prefix(siteId, 'meta/categories.json'), categories);
}

// ─── Tags ──────────────────────────────────────────────────

export async function getTags(bucket: R2Bucket, siteId: string): Promise<Tag[]> {
  return getJson<Tag[]>(bucket, prefix(siteId, 'meta/tags.json'), []);
}

export async function putTags(bucket: R2Bucket, siteId: string, tags: Tag[]): Promise<void> {
  await putJson(bucket, prefix(siteId, 'meta/tags.json'), tags);
}

// ─── Authors ───────────────────────────────────────────────

export async function getAuthors(bucket: R2Bucket, siteId: string): Promise<Author[]> {
  return getJson<Author[]>(bucket, prefix(siteId, 'meta/authors.json'), []);
}

export async function putAuthors(bucket: R2Bucket, siteId: string, authors: Author[]): Promise<void> {
  await putJson(bucket, prefix(siteId, 'meta/authors.json'), authors);
}

// ─── Collections ───────────────────────────────────────────

export async function getCollections(bucket: R2Bucket, siteId: string): Promise<Collection[]> {
  return getJson<Collection[]>(bucket, prefix(siteId, 'meta/collections.json'), []);
}

export async function putCollections(bucket: R2Bucket, siteId: string, collections: Collection[]): Promise<void> {
  await putJson(bucket, prefix(siteId, 'meta/collections.json'), collections);
}

// ─── Incremental Meta Update ───────────────────────────────

/**
 * Incrementally update meta counts based on a post change.
 * @param oldPost - The post before the change (null = new post)
 * @param newPost - The post after the change (null = deleted post)
 */
export async function updateMetaIncremental(
  bucket: R2Bucket,
  siteId: string,
  oldPost: PostSummary | null,
  newPost: PostSummary | null,
): Promise<void> {
  // Compute diffs
  const oldCats = new Set(oldPost?.categories || []);
  const newCats = new Set(newPost?.categories || []);
  const oldTags = new Set(oldPost?.tags || []);
  const newTags = new Set(newPost?.tags || []);
  const oldAuthor = oldPost?.author || null;
  const newAuthor = newPost?.author || null;
  const oldCollection = oldPost?.collection || null;
  const newCollection = newPost?.collection || null;

  // Category diffs
  const catsAdded = [...newCats].filter((c) => !oldCats.has(c));
  const catsRemoved = [...oldCats].filter((c) => !newCats.has(c));

  // Tag diffs
  const tagsAdded = [...newTags].filter((t) => !oldTags.has(t));
  const tagsRemoved = [...oldTags].filter((t) => !newTags.has(t));

  const updates: Promise<void>[] = [];

  // Update categories if changed
  if (catsAdded.length > 0 || catsRemoved.length > 0) {
    updates.push((async () => {
      const categories = await getCategories(bucket, siteId);
      const catMap = new Map(categories.map((c) => [c.slug, c]));

      for (const slug of catsAdded) {
        const existing = catMap.get(slug);
        if (existing) {
          existing.count++;
        } else {
          catMap.set(slug, { slug, name: slug, description: '', count: 1 });
        }
      }
      for (const slug of catsRemoved) {
        const existing = catMap.get(slug);
        if (existing) existing.count = Math.max(0, existing.count - 1);
      }

      const result = [...catMap.values()].sort((a, b) => b.count - a.count);
      await putCategories(bucket, siteId, result);
    })());
  }

  // Update tags if changed
  if (tagsAdded.length > 0 || tagsRemoved.length > 0) {
    updates.push((async () => {
      const tags = await getTags(bucket, siteId);
      const tagMap = new Map(tags.map((t) => [t.slug, t]));

      for (const slug of tagsAdded) {
        const existing = tagMap.get(slug);
        if (existing) {
          existing.count++;
        } else {
          tagMap.set(slug, { slug, name: slug, count: 1 });
        }
      }
      for (const slug of tagsRemoved) {
        const existing = tagMap.get(slug);
        if (existing) existing.count = Math.max(0, existing.count - 1);
      }

      const result = [...tagMap.values()].sort((a, b) => b.count - a.count);
      await putTags(bucket, siteId, result);
    })());
  }

  // Update authors if changed
  if (oldAuthor !== newAuthor) {
    updates.push((async () => {
      const authors = await getAuthors(bucket, siteId);
      const authorMap = new Map(authors.map((a) => [a.id, a]));

      if (newAuthor) {
        const existing = authorMap.get(newAuthor);
        if (existing) {
          existing.count++;
        } else {
          authorMap.set(newAuthor, { id: newAuthor, name: newAuthor, count: 1 });
        }
      }
      if (oldAuthor) {
        const existing = authorMap.get(oldAuthor);
        if (existing) existing.count = Math.max(0, existing.count - 1);
      }

      const result = [...authorMap.values()].sort((a, b) => b.count - a.count);
      await putAuthors(bucket, siteId, result);
    })());
  }

  // Update collections if changed
  if (oldCollection !== newCollection) {
    updates.push((async () => {
      const collections = await getCollections(bucket, siteId);
      // Collections don't have count, but ensure entry exists
      if (newCollection && !collections.find((c) => c.key === newCollection)) {
        collections.push({ key: newCollection, name: newCollection, description: '' });
        await putCollections(bucket, siteId, collections);
      }
    })());
  }

  await Promise.all(updates);
}

// ─── Full Rebuild from Post List ───────────────────────────

/**
 * Full rebuild of all meta counts from a complete post list.
 * Preserves existing name/description/bio/avatar/social fields.
 */
export async function rebuildMetaFromPosts(
  bucket: R2Bucket,
  siteId: string,
  allPosts: PostSummary[],
): Promise<void> {
  // Count everything
  const catCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const authorCounts = new Map<string, number>();
  const collectionSet = new Set<string>();

  for (const post of allPosts) {
    for (const cat of post.categories) catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
    for (const tag of post.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    authorCounts.set(post.author, (authorCounts.get(post.author) || 0) + 1);
    if (post.collection) collectionSet.add(post.collection);
  }

  // Load existing meta (to preserve human-edited fields)
  const [existingCats, existingTags, existingAuthors, existingCollections] = await Promise.all([
    getCategories(bucket, siteId),
    getTags(bucket, siteId),
    getAuthors(bucket, siteId),
    getCollections(bucket, siteId),
  ]);

  // Rebuild categories
  const catMap = new Map(existingCats.map((c) => [c.slug, c]));
  const newCats: Category[] = [];
  for (const [slug, count] of catCounts) {
    const existing = catMap.get(slug);
    newCats.push({
      slug,
      name: existing?.name || slug,
      description: existing?.description || '',
      featuredImage: existing?.featuredImage,
      count,
    });
  }
  newCats.sort((a, b) => b.count - a.count);

  // Rebuild tags
  const tagMap = new Map(existingTags.map((t) => [t.slug, t]));
  const newTags: Tag[] = [];
  for (const [slug, count] of tagCounts) {
    const existing = tagMap.get(slug);
    newTags.push({
      slug,
      name: existing?.name || slug,
      description: existing?.description,
      featuredImage: existing?.featuredImage,
      count,
    });
  }
  newTags.sort((a, b) => b.count - a.count);

  // Rebuild authors
  const authorMap = new Map(existingAuthors.map((a) => [a.id, a]));
  const newAuthors: Author[] = [];
  for (const [id, count] of authorCounts) {
    const existing = authorMap.get(id);
    newAuthors.push({
      id,
      name: existing?.name || id,
      bio: existing?.bio,
      avatar: existing?.avatar,
      url: existing?.url,
      email: existing?.email,
      social: existing?.social,
      count,
    });
  }
  newAuthors.sort((a, b) => b.count - a.count);

  // Rebuild collections
  const collMap = new Map(existingCollections.map((c) => [c.key, c]));
  const newCollections: Collection[] = [];
  for (const key of collectionSet) {
    const existing = collMap.get(key);
    newCollections.push({
      key,
      name: existing?.name || key,
      description: existing?.description || '',
      coverImage: existing?.coverImage,
      order: existing?.order,
    });
  }
  // Also keep collections that exist in meta but have no posts (manually created)
  for (const existing of existingCollections) {
    if (!collectionSet.has(existing.key)) {
      newCollections.push(existing);
    }
  }
  newCollections.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  // Write all in parallel
  await Promise.all([
    putCategories(bucket, siteId, newCats),
    putTags(bucket, siteId, newTags),
    putAuthors(bucket, siteId, newAuthors),
    putCollections(bucket, siteId, newCollections),
  ]);
}
