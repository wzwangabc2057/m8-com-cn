import { z } from 'zod';

export const ListCategoriesSchema = z.object({
  siteId: z.string().optional(),
});

export const CreateCategorySchema = z.object({
  siteId: z.string().optional(),
  name: z.string(),
  slug: z.string().optional(),
  description: z.string().optional(),
  featuredImage: z.string().optional(),
});

export const UpdateCategorySchema = CreateCategorySchema.partial().extend({
  slug: z.string(), // Required for update
});

export const DeleteCategorySchema = z.object({
  siteId: z.string().optional(),
  slug: z.string(),
});

export const GetCategorySchema = DeleteCategorySchema;
