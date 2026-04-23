import { z } from 'zod';

export const ListAuthorsSchema = z.object({
  siteId: z.string().optional(),
});

export const CreateAuthorSchema = z.object({
  siteId: z.string().optional(),
  name: z.string(),
  id: z.string().optional(),
  bio: z.string().optional(),
  avatar: z.string().optional(),
  email: z.string().email().optional(),
  url: z.string().url().optional(),
});

export const UpdateAuthorSchema = CreateAuthorSchema.partial().extend({
  id: z.string(), // Required for update
});

export const DeleteAuthorSchema = z.object({
  siteId: z.string().optional(),
  id: z.string(),
});

export const GetAuthorSchema = DeleteAuthorSchema;
