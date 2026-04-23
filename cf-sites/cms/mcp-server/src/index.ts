import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { registerResources } from "./resources/site.js";
import { definitions as postDefs, handlers as postHandlers } from "./tools/posts.js";
import { definitions as catDefs, handlers as catHandlers } from "./tools/categories.js";
import { definitions as tagDefs, handlers as tagHandlers } from "./tools/tags.js";
import { definitions as authDefs, handlers as authHandlers } from "./tools/authors.js";
import { definitions as colDefs, handlers as colHandlers } from "./tools/collections.js";
import { definitions as configDefs, handlers as configHandlers } from "./tools/config.js";
import { definitions as miscDefs, handlers as miscHandlers } from "./tools/misc.js";
import { writerPrompt, getWriterPrompt } from "./prompts/writer.js";
import { auditPrompt, getAuditPrompt } from "./prompts/audit.js";
import { formatError } from "./lib/utils.js";

const server = new Server(
  {
    name: "cloudflare-cms-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

// Register Resources
registerResources(server);

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

// ─── Tools ────────────────────────────────────────────────

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
    return await handler(args);
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${formatError(error)}` }],
      isError: true,
    };
  }
});

// ─── Prompts (Skills) ─────────────────────────────────────

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

// ─── Start Server ─────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MCP Server running on stdio");
