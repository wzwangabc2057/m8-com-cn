import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CloudflareWebSocketTransport } from "../../src/mcp/transport.js";
import { setupMcpServer } from "../../src/mcp/server.js";
import { Env } from "../../src/types.js";
import { requireAuth } from "../../src/utils/auth.js";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Check Auth
  const authError = requireAuth(request, env);
  if (authError) return authError;

  const upgradeHeader = request.headers.get("Upgrade");
  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();

  // Setup MCP Server
  const mcpServer = new Server(
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

  setupMcpServer(mcpServer, env);

  const transport = new CloudflareWebSocketTransport(server);
  
  // Connect but handle potential transport errors gracefully
  mcpServer.connect(transport).catch(err => {
    console.error("MCP Server connection error:", err);
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
};
