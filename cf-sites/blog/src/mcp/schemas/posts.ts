import { z } from 'zod';

export const ListPostsSchema = z.object({
  siteId: z.string().optional(),
  limit: z.number().optional(),
  page: z.number().optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
  author: z.string().optional(),
  collection: z.string().optional(),
});

export const CreatePostSchema = z.object({
  siteId: z.string().optional(),
  title: z.string(),
  content: z.string(), // HTML or Markdown
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  seo: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    noindex: z.boolean().optional(),
  }).optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  collection: z.string().optional(),
  author: z.string().optional(),
  featuredImage: z.string().optional(),
});

export const UpdatePostSchema = CreatePostSchema.partial().extend({
  slug: z.string(), // Required for update
});

export const GetPostSchema = z.object({
  siteId: z.string().optional(),
  slug: z.string(),
});
