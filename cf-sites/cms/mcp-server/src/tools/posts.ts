import { zodToJsonSchema } from 'zod-to-json-schema';
import { api } from '../lib/api.js';
import { DEFAULT_SITE_ID } from '../config.js';
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
  list_posts: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, ...params } = ListPostsSchema.parse(args);
    const res = await api.get('/posts', { params: { siteId, ...params } });
    return {
      content: [{ type: "text", text: JSON.stringify(res.data.posts || res.data, null, 2) }],
    };
  },
  get_post: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, slug } = GetPostSchema.parse(args);
    const res = await api.get(`/posts/${slug}`, { params: { siteId } });
    return {
      content: [{ type: "text", text: JSON.stringify(res.data.post || res.data, null, 2) }],
    };
  },
  create_post: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, ...data } = CreatePostSchema.parse(args);
    const res = await api.post('/posts', data, { params: { siteId } });
    return {
      content: [{ type: "text", text: `Post created successfully. Slug: ${res.data.slug || 'unknown'}` }],
    };
  },
  update_post: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, slug, ...data } = UpdatePostSchema.parse(args);
    await api.put(`/posts/${slug}`, data, { params: { siteId } });
    return {
      content: [{ type: "text", text: `Post updated successfully.` }],
    };
  },
};
