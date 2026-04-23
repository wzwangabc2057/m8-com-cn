import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

/**
 * A Transport implementation that uses a Cloudflare Worker WebSocket.
 */
export class CloudflareWebSocketTransport implements Transport {
  private _socket: WebSocket;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(socket: WebSocket) {
    this._socket = socket;
    
    this._socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data as string);
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(new Error(`Failed to parse message: ${error}`));
      }
    });

    this._socket.addEventListener("close", () => {
      this.onclose?.();
    });

    this._socket.addEventListener("error", () => {
      this.onerror?.(new Error("WebSocket error"));
    });
  }

  async start(): Promise<void> {
    // Already started when connection accepted
    // Ideally we might wait for 'open', but server-side sockets are usually open immediately
    if (this._socket.readyState === WebSocket.CONNECTING) {
      await new Promise<void>((resolve) => {
        this._socket.addEventListener("open", () => resolve(), { once: true });
      });
    }
  }

  async close(): Promise<void> {
    this._socket.close();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this._socket.send(JSON.stringify(message));
  }
}
