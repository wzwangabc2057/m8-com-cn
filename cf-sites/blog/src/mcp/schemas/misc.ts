import { z } from 'zod';

export const GetAnalyticsSchema = z.object({
  siteId: z.string().optional(),
  range: z.string().optional(),
});

export const MaintenanceSchema = z.object({
  siteId: z.string().optional(),
  enabled: z.boolean(),
  message: z.string().optional(),
});
