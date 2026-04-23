import { zodToJsonSchema } from 'zod-to-json-schema';
import { Env } from '../../types.js';
import { getConfig, putConfig } from '../../services/content.js';
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
  get_site_config: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID } = GetConfigSchema.parse(args);
    const config = await getConfig(env.CONTENT_BUCKET, siteId);
    return {
      content: [{ type: "text", text: JSON.stringify(config, null, 2) }],
    };
  },
  update_site_config: async (args: any, env: Env) => {
    const { siteId = env.SITE_ID, config } = UpdateConfigSchema.parse(args);
    await putConfig(env.CONTENT_BUCKET, siteId, config);
    return {
      content: [{ type: "text", text: `Configuration updated successfully.` }],
    };
  },
};
