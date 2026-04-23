import { zodToJsonSchema } from 'zod-to-json-schema';
import { Env } from '../../types.js';
import { getPost, getPostsFromShards, getFeed } from '../../services/content.js';
import { upsertPost } from '../../services/indexing.js';
import { ListPostsSchema, CreatePostSchema, UpdatePostSchema, GetPostSchema } from '../schemas/posts.js';

export const definitions = [
  {
    name: "list_posts",
    description: "List posts for a site. Returns metadata only.",
    inputSchema: zodToJsonSchema(ListPostsSchema),
  },
  {
    name: "get_post",
    description: "Get full content of a specific post (including HTML).",
    inputSchema: zodToJsonSchema(GetPostSchema),
  },
  {
    name: "create_post",
    description: "Create a new post. External images in content will be auto-downloaded.",
    inputSchema: zodToJsonSchema(CreatePostSchema),
  },
  {
    name: "update_post",
    description: "Update an existing post.",
    inputSchema: zodToJsonSchema(UpdatePostSchema),
  },
];

export const handlers = {
  list_posts: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, limit = 20, page = 1, category, tag, author, collection } = ListPostsSchema.parse(args);
    
    // Filter logic similar to functions/api/posts/index.ts
    if (category) {
      const feedPosts = await getFeed(env.CONTENT_BUCKET, siteId, `category/${category}`);
      return { content: [{ type: "text", text: JSON.stringify(paginate(feedPosts, page, limit), null, 2) }] };
    }
    if (tag) {
      const feedPosts = await getFeed(env.CONTENT_BUCKET, siteId, `tag/${tag}`);
      return { content: [{ type: "text", text: JSON.stringify(paginate(feedPosts, page, limit), null, 2) }] };
    }
    if (author) {
      const feedPosts = await getFeed(env.CONTENT_BUCKET, siteId, `author/${author}`);
      return { content: [{ type: "text", text: JSON.stringify(paginate(feedPosts, page, limit), null, 2) }] };
    }
    if (collection) {
      const feedPosts = await getFeed(env.CONTENT_BUCKET, siteId, `collection/${collection}`);
      return { content: [{ type: "text", text: JSON.stringify(paginate(feedPosts, page, limit), null, 2) }] };
    }

    const { posts, total } = await getPostsFromShards(env.CONTENT_BUCKET, siteId, page, limit);
    return {
      content: [{ type: "text", text: JSON.stringify({ posts, total, page, pageSize: limit }, null, 2) }],
    };
  },

  get_post: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, slug } = GetPostSchema.parse(args);
    const post = await getPost(env.CONTENT_BUCKET, siteId, slug);
    if (!post) throw new Error(`Post not found: ${slug}`);
    return {
      content: [{ type: "text", text: JSON.stringify(post, null, 2) }],
    };
  },

  create_post: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, ...data } = CreatePostSchema.parse(args);
    
    // Construct Post object
    const now = new Date().toISOString();
    const post: any = {
      slug: data.slug || slugify(data.title),
      title: data.title,
      content: data.content,
      excerpt: data.excerpt || '',
      coverImage: data.featuredImage,
      author: data.author || 'admin', // Default author?
      categories: data.categories || [],
      tags: data.tags || [],
      collection: data.collection || '',
      publishedAt: now,
      updatedAt: now,
      status: data.status || 'published',
      seo: data.seo,
      layout: 'default', // Default
    };

    await upsertPost(env.CONTENT_BUCKET, siteId, post, null);
    
    return {
      content: [{ type: "text", text: `Post created successfully. Slug: ${post.slug}` }],
    };
  },

  update_post: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, slug, ...data } = UpdatePostSchema.parse(args);
    
    const oldPost = await getPost(env.CONTENT_BUCKET, siteId, slug);
    if (!oldPost) throw new Error(`Post not found: ${slug}`);

    const updatedPost = {
      ...oldPost,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await upsertPost(env.CONTENT_BUCKET, siteId, updatedPost, oldPost);

    return {
      content: [{ type: "text", text: `Post updated successfully.` }],
    };
  },
};

function paginate(posts: any[], page: number, limit: number) {
  const start = (page - 1) * limit;
  return {
    posts: posts.slice(start, start + limit),
    total: posts.length,
    page,
    pageSize: limit
  };
}

function slugify(text: string) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}
