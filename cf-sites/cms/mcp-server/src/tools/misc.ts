import { zodToJsonSchema } from 'zod-to-json-schema';
import { api } from '../lib/api.js';
import { DEFAULT_SITE_ID } from '../config.js';
import { GetAnalyticsSchema, MaintenanceSchema } from '../schemas/misc.js';

export const definitions = [
  {
    name: "get_analytics",
    description: "Get traffic analytics for the site (visits/views).",
    inputSchema: zodToJsonSchema(GetAnalyticsSchema),
  },
  {
    name: "trigger_maintenance",
    description: "Enable or disable maintenance mode.",
    inputSchema: zodToJsonSchema(MaintenanceSchema),
  },
];

export const handlers = {
  get_analytics: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, range = "7d" } = GetAnalyticsSchema.parse(args);
    const res = await api.get('/analytics', { params: { siteId, range } });
    return {
      content: [{ type: "text", text: JSON.stringify(res.data.data || res.data, null, 2) }],
    };
  },
  trigger_maintenance: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, enabled, message } = MaintenanceSchema.parse(args);
    await api.post('/maintenance', { enabled, message }, { params: { siteId } });
    return {
      content: [{ type: "text", text: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}.` }],
    };
  },
};
