import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Env } from "../types.js";

// Import Tools
import { definitions as postDefs, handlers as postHandlers } from "./tools/posts.js";
import { definitions as catDefs, handlers as catHandlers } from "./tools/categories.js";
import { definitions as tagDefs, handlers as tagHandlers } from "./tools/tags.js";
import { definitions as authDefs, handlers as authHandlers } from "./tools/authors.js";
import { definitions as colDefs, handlers as colHandlers } from "./tools/collections.js";
import { definitions as configDefs, handlers as configHandlers } from "./tools/config.js";
import { definitions as miscDefs, handlers as miscHandlers } from "./tools/misc.js";

// Import Prompts
import { writerPrompt, getWriterPrompt } from "./prompts/writer.js";
import { auditPrompt, getAuditPrompt } from "./prompts/audit.js";

// Import Resources
import { registerResources } from "./resources/site.js";

export function setupMcpServer(server: Server, env: Env) {
  // Register Resources
  registerResources(server, env);

  // Aggregate Tools
  const toolDefinitions = [
    ...postDefs,
    ...catDefs,
    ...tagDefs,
    ...authDefs,
    ...colDefs,
    ...configDefs,
    ...miscDefs,
  ];

  const toolHandlers = {
    ...postHandlers,
    ...catHandlers,
    ...tagHandlers,
    ...authHandlers,
    ...colHandlers,
    ...configHandlers,
    ...miscHandlers,
  };

  // Register Tool Handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: toolDefinitions };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = toolHandlers[name as keyof typeof toolHandlers];

    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      return await handler(args, env);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  });

  // Register Prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [writerPrompt, auditPrompt],
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "writer") {
      return getWriterPrompt(args);
    }
    if (name === "audit") {
      return getAuditPrompt();
    }

    throw new Error(`Unknown prompt: ${name}`);
  });
}
