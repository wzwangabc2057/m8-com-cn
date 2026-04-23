import { z } from 'zod';

export const ListCollectionsSchema = z.object({
  siteId: z.string().optional(),
});

export const CreateCollectionSchema = z.object({
  siteId: z.string().optional(),
  name: z.string(),
  key: z.string().optional(),
  description: z.string().optional(),
  coverImage: z.string().optional(),
  order: z.number().optional(),
});

export const UpdateCollectionSchema = CreateCollectionSchema.partial().extend({
  key: z.string(), // Required for update
});

export const DeleteCollectionSchema = z.object({
  siteId: z.string().optional(),
  key: z.string(),
});

export const GetCollectionSchema = DeleteCollectionSchema;
