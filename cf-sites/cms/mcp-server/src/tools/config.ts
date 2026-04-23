import { zodToJsonSchema } from 'zod-to-json-schema';
import { api } from '../lib/api.js';
import { DEFAULT_SITE_ID } from '../config.js';
import { GetConfigSchema, UpdateConfigSchema } from '../schemas/config.js';

export const definitions = [
  {
    name: "get_site_config",
    description: "Get the current site configuration.",
    inputSchema: zodToJsonSchema(GetConfigSchema),
  },
  {
    name: "update_site_config",
    description: "Update the site configuration.",
    inputSchema: zodToJsonSchema(UpdateConfigSchema),
  },
];

export const handlers = {
  get_site_config: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID } = GetConfigSchema.parse(args);
    const res = await api.get('/config', { params: { siteId } });
    return {
      content: [{ type: "text", text: JSON.stringify(res.data.config || res.data, null, 2) }],
    };
  },
  update_site_config: async (args: any) => {
    const { siteId = DEFAULT_SITE_ID, config } = UpdateConfigSchema.parse(args);
    await api.put('/config', config, { params: { siteId } });
    return {
      content: [{ type: "text", text: `Configuration updated successfully.` }],
    };
  },
};
