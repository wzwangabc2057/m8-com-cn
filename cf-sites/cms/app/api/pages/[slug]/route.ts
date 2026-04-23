
import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { getPost, deletePost, savePost } from '@/lib/r2-utils';
import { savePostToD1, deletePostFromD1 } from '@/lib/d1-utils';
import { NextRequest } from 'next/server';
import type { Post } from '@/lib/types';
import { processContentImages } from '@/lib/image-processor';
import { invalidateCache, pageCacheKeys } from '@/lib/cache-invalidation';

export const runtime = 'edge';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId');

  const env = await getEnv();
  const post = await getPost(env.CONTENT_BUCKET, siteId, slug);

  if (!post) return errorResponse('Page not found', 404);
  if (post.type !== 'page') return errorResponse('Not a page', 404);

  // Replace proxy URLs with clean public URLs for the editor view
  if (post.content) {
    const proxyRegex = /\/api\/proxy\?key=([^"'\s&]+)/g;
    post.content = post.content.replace(proxyRegex, (_, encodedKey) => {
      try {
        const key = decodeURIComponent(encodedKey);
        const prefix = `sites/${siteId}/assets/`;
        if (key.startsWith(prefix)) {
          return `/site-assets/${key.slice(prefix.length)}`;
        }
      } catch (e) {}
      return `/api/proxy?key=${encodedKey}`;
    });
  }

  return jsonResponse({ post });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId');

  try {
    const body = await req.json<Partial<Post>>();

    // If slug is provided in body, it must match the URL slug
    if (body.slug && body.slug !== slug) return errorResponse('Slug mismatch');

    const env = await getEnv();

    // Load existing page to merge with partial update
    const existing = await getPost(env.CONTENT_BUCKET, siteId, slug);
    if (!existing) return errorResponse('Page not found', 404);

    const post: Post = {
      ...existing,
      ...body,
      slug, // Always use URL slug
      type: 'page',
    };

    // Process Images
    if (post.content) {
      post.content = await processContentImages(post.content, siteId, env.CONTENT_BUCKET);
    }
    
    await savePost(env.CONTENT_BUCKET, siteId, post);
    await savePostToD1(env.DB, siteId, post);

    // Invalidate cache
    await invalidateCache(env.EVENTS_QUEUE, pageCacheKeys(siteId, slug));

    return jsonResponse({ success: true, slug });
  } catch (err: any) {
    return errorResponse(err.message || 'Failed to update page');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId');

  const env = await getEnv();
  
  await deletePost(env.CONTENT_BUCKET, siteId, slug);
  await deletePostFromD1(env.DB, siteId, slug);

  // Invalidate cache
  await invalidateCache(env.EVENTS_QUEUE, pageCacheKeys(siteId, slug));

  return jsonResponse({ success: true });
}
