import { ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { api } from '../lib/api.js';
import { DEFAULT_SITE_ID } from '../config.js';

export const registerResources = (server: Server) => {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: `cms://${DEFAULT_SITE_ID}/config`,
          name: "Site Configuration",
          mimeType: "application/json",
          description: "Current site configuration including name, SEO, and navigation.",
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = new URL(request.params.uri);
    const siteId = uri.hostname || DEFAULT_SITE_ID;
    const path = uri.pathname;

    if (path === "/config") {
      try {
        const res = await api.get(`/config?siteId=${siteId}`);
        return {
          contents: [
            {
              uri: request.params.uri,
              mimeType: "application/json",
              text: JSON.stringify(res.data.config || res.data, null, 2),
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
