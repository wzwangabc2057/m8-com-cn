import type { PostSummary, PaginatedPosts, PaginationInfo } from '../types.js';

export interface PaginateOptions {
  posts: PostSummary[];
  page: number;
  pageSize: number;
  baseUrl: string; // e.g. "/category/frontend"
}

/**
 * Paginate a full array of posts (for feed-based reads).
 */
export function paginate(opts: PaginateOptions): PaginatedPosts {
  const { posts, page, pageSize, baseUrl } = opts;
  const total = posts.length;
  const pagination = buildPagination(total, page, pageSize, baseUrl);
  const start = (pagination.current - 1) * pageSize;
  const sliced = posts.slice(start, start + pageSize);

  return { posts: sliced, pagination };
}

/**
 * Build pagination info without needing the full array.
 * Used when posts are already sliced (from shard reads).
 */
export function buildPagination(
  total: number,
  page: number,
  pageSize: number,
  baseUrl: string,
): PaginationInfo {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.max(1, Math.min(page, totalPages));
  const hasNext = current < totalPages;
  const hasPrev = current > 1;

  return {
    current,
    totalPages,
    total,
    pageSize,
    hasNext,
    hasPrev,
    nextUrl: hasNext ? `${baseUrl}/page/${current + 1}` : null,
    prevUrl: hasPrev
      ? current === 2
        ? baseUrl
        : `${baseUrl}/page/${current - 1}`
      : null,
  };
}
