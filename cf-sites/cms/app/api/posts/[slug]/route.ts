
import { getEnv, jsonResponse, errorResponse, requireAuth } from '@/lib/api-utils';
import { getPost, deletePost, savePost, getConfig } from '@/lib/r2-utils';
import { savePostToD1, deletePostFromD1 } from '@/lib/d1-utils';
import { NextRequest } from 'next/server';
import type { Post } from '@/lib/types';
import { processContentImages } from '@/lib/image-processor';
import { invalidateCache, postCacheKeys } from '@/lib/cache-invalidation';

export const runtime = 'edge';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await requireAuth(req))) return errorResponse('Unauthorized', 401);

  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return errorResponse('Missing siteId');

  const env = await getEnv();
  
  // Parallel fetch: R2 (content) and D1 (metadata)
  const [postR2, d1Result] = await Promise.all([
    getPost(env.CONTENT_BUCKET, siteId, slug),
    env.DB.prepare('SELECT * FROM posts WHERE siteId = ? AND slug = ?').bind(siteId, slug).all()
  ]);

  // When slug is "index" and no page exists, return synthetic index from config so CMS preview works
  if (!postR2 && slug === 'index') {
    const config = await getConfig(env.CONTENT_BUCKET, siteId);
    const home = config.home || {};
    const synthetic: Post = {
      slug: 'index',
      title: home.title || config.name || 'Home',
      excerpt: home.subtitle || config.description || '',
      content: '',
      type: 'page',
      status: 'published',
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: '',
      categories: [],
      tags: [],
      collection: '',
      layout: 'default',
      showTitle: true,
      showHeader: true,
      showFooter: true,
    };
    return jsonResponse({ post: synthetic });
  }

  if (!postR2) return errorResponse('Post not found', 404);
  const type = postR2.type || 'post';
  if (type !== 'post' && type !== 'page') return errorResponse('Not a post or page', 404);

  const postD1 = d1Result.results[0] as any;
  const post = {
    ...postR2,
    ...(postD1 ? {
      title: postD1.title,
      excerpt: postD1.excerpt,
      status: postD1.status,
      publishedAt: postD1.publishedAt,
      author: postD1.author,
      coverImage: postD1.coverImage,
    } : {})
  };

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

    if (body.slug && body.slug !== slug) return errorResponse('Slug mismatch');

    const env = await getEnv();

    // Load existing post to merge with partial update
    const existing = await getPost(env.CONTENT_BUCKET, siteId, slug);
    if (!existing) return errorResponse('Post not found', 404);

    const post: Post = {
      ...existing,
      ...body,
      slug,
      type: 'post',
    };
    
    // Process Images
    if (post.content) {
      post.content = await processContentImages(post.content, siteId, env.CONTENT_BUCKET);
    }
    
    await savePost(env.CONTENT_BUCKET, siteId, post);
    await savePostToD1(env.DB, siteId, post);

    // Invalidate cache
    await invalidateCache(env.EVENTS_QUEUE, postCacheKeys(siteId, slug));

    return jsonResponse({ success: true, slug });
  } catch (err: any) {
    return errorResponse(err.message || 'Failed to update post');
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
  await invalidateCache(env.EVENTS_QUEUE, postCacheKeys(siteId, slug));

  return jsonResponse({ success: true });
}
