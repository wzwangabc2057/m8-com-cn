import { ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Env } from '../../types.js';
import { getConfig } from '../../services/content.js';

export const registerResources = (server: Server, env: Env) => {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: `cms://${env.SITE_ID}/config`,
          name: "Site Configuration",
          mimeType: "application/json",
          description: "Current site configuration including name, SEO, and navigation.",
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = new URL(request.params.uri);
    const siteId = uri.hostname || env.SITE_ID;
    const path = uri.pathname;

    if (path === "/config") {
      try {
        const config = await getConfig(env.CONTENT_BUCKET, siteId);
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: "application/json",
              text: JSON.stringify(config, null, 2),
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to fetch config: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new Error("Resource not found");
  });
};
