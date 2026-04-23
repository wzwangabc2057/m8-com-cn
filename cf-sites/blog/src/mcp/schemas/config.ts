import { z } from 'zod';

export const GetConfigSchema = z.object({
  siteId: z.string().optional(),
});

export const UpdateConfigSchema = z.object({
  siteId: z.string().optional(),
  config: z.any(), // Complex object, validate partially if needed or trust
});
