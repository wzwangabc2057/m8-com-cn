import { z } from 'zod';

export const ListTagsSchema = z.object({
  siteId: z.string().optional(),
});

export const CreateTagSchema = z.object({
  siteId: z.string().optional(),
  name: z.string(),
  slug: z.string().optional(),
  description: z.string().optional(),
  featuredImage: z.string().optional(),
});

export const UpdateTagSchema = CreateTagSchema.partial().extend({
  slug: z.string(), // Required for update
});

export const DeleteTagSchema = z.object({
  siteId: z.string().optional(),
  slug: z.string(),
});

export const GetTagSchema = DeleteTagSchema;
