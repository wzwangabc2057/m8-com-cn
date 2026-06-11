import type { Author, PostSummary } from '../types.js';

export interface ResolvedAuthorIdentity {
  authorCanonicalId: string;
  authorDisplayName: string;
  authorObj?: Author;
}

interface SitePublicAuthorOverride {
  canonicalId: string;
  displayName: string;
}

const SITE_PUBLIC_AUTHOR_OVERRIDES: Record<string, SitePublicAuthorOverride> = {
  'm8.com.cn': {
    canonicalId: 'm8-kangge',
    displayName: 'm8 康哥',
  },
};

function buildAuthorLookup(authors: Author[]): Map<string, Author> {
  const lookup = new Map<string, Author>();
  for (const author of authors) {
    if (author.id) lookup.set(author.id, author);
    if (author.name) lookup.set(author.name, author);
  }
  return lookup;
}

function getSitePublicAuthorOverride(siteId?: string): SitePublicAuthorOverride | undefined {
  return siteId ? SITE_PUBLIC_AUTHOR_OVERRIDES[siteId] : undefined;
}

function buildPublicAuthor(authors: Author[], override: SitePublicAuthorOverride): Author {
  const lookup = buildAuthorLookup(authors);
  const authorObj = lookup.get(override.canonicalId) || lookup.get(override.displayName);
  const totalCount = authors.reduce((sum, author) => sum + (author.count || 0), 0);

  return {
    id: override.canonicalId,
    name: override.displayName,
    bio: authorObj?.bio,
    avatar: authorObj?.avatar,
    url: authorObj?.url,
    email: authorObj?.email,
    social: authorObj?.social,
    count: totalCount,
  };
}

export function getPublicAuthorCanonicalId(siteId?: string): string | undefined {
  return getSitePublicAuthorOverride(siteId)?.canonicalId;
}

export function getVisibleAuthors(authors: Author[], siteId?: string): Author[] {
  const override = getSitePublicAuthorOverride(siteId);
  if (!override) return authors;
  return [buildPublicAuthor(authors, override)];
}

export function resolveAuthorIdentity(
  authors: Author[],
  rawAuthor?: string | null,
  fallbackAuthorId?: string,
  siteId?: string,
): ResolvedAuthorIdentity {
  const override = getSitePublicAuthorOverride(siteId);
  if (override) {
    const authorObj = buildPublicAuthor(authors, override);
    return {
      authorCanonicalId: override.canonicalId,
      authorDisplayName: override.displayName,
      authorObj,
    };
  }

  const lookup = buildAuthorLookup(authors);
  const candidate = rawAuthor || fallbackAuthorId || '';
  const authorObj = (candidate ? lookup.get(candidate) : undefined)
    || (fallbackAuthorId ? lookup.get(fallbackAuthorId) : undefined);

  return {
    authorCanonicalId: authorObj?.id || candidate,
    authorDisplayName: authorObj?.name || candidate,
    authorObj,
  };
}

export function enrichPostsWithAuthorIdentity<T extends PostSummary>(
  posts: T[],
  authors: Author[],
  siteId?: string,
): Array<T & { authorCanonicalId: string; authorDisplayName: string }> {
  return posts.map((post) => {
    const resolved = resolveAuthorIdentity(authors, post.author, undefined, siteId);
    return {
      ...post,
      authorCanonicalId: resolved.authorCanonicalId,
      authorDisplayName: resolved.authorDisplayName,
    };
  });
}
