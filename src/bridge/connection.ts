/**
 * WebSocket bridge connection for VFX Forge MCP
 * Uses Bun's native WebSocket server for communication with the Roblox plugin
 */

import type { ServerWebSocket } from "bun";
import type {
  BridgeMessage,
  BridgeRequest,
  BridgeResponse,
  ErrorInfo,
} from "../types/messages.js";

const REQUEST_TIMEOUT_MS = 30000;

interface PendingRequest {
  resolve: (value: BridgeResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface PluginConnection {
  ws: ServerWebSocket<WebSocketData>;
  pluginVersion: string;
  connectedAt: number;
}

interface WebSocketData {
  id: string;
}

export interface PluginBridge {
  sendRequest: (
    method: string,
    params: Record<string, unknown>,
  ) => Promise<BridgeResponse>;
  isConnected: () => boolean;
  shutdown: () => void;
  onEvent: (handler: (event: BridgeMessage) => void) => void;
  getConnectionInfo: () => {
    connected: boolean;
    pluginVersion?: string;
    connectedAt?: number;
  };
}

export async function createBridge(port: number): Promise<PluginBridge> {
  let connection: PluginConnection | null = null;
  const pendingRequests = new Map<string, PendingRequest>();
  const eventHandlers: Array<(event: BridgeMessage) => void> = [];

  const server = Bun.serve<WebSocketData>({
    port,

    fetch(req, server) {
      const url = new URL(req.url);

      // Handle WebSocket upgrade
      if (url.pathname === "/" || url.pathname === "/ws") {
        const id = crypto.randomUUID();
        const upgraded = server.upgrade(req, {
          data: { id },
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        });

        if (upgraded) {
          return undefined;
        }

        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      // Health check endpoint
      if (url.pathname === "/health") {
        return Response.json({
          status: "ok",
          connected: connection !== null,
          pendingRequests: pendingRequests.size,
          pluginVersion: connection?.pluginVersion,
          uptime: connection ? Date.now() - connection.connectedAt : 0,
        });
      }

      // CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      return new Response("Not Found", { status: 404 });
    },

    websocket: {
      open(ws) {
        console.error("[Bridge] WebSocket connection opened");

        // Close existing connection if any
        if (connection) {
          console.error("[Bridge] Closing existing connection");
          connection.ws.close(1000, "New connection established");
        }

        connection = {
          ws,
          pluginVersion: "unknown",
          connectedAt: Date.now(),
        };

        // Send welcome message
        ws.send(
          JSON.stringify({
            type: "welcome",
            serverVersion: "0.1.0",
            timestamp: Date.now(),
          }),
        );
      },

      message(ws, message) {
        try {
          const data =
            typeof message === "string"
              ? message
              : new TextDecoder().decode(message);
          const parsed = JSON.parse(data) as BridgeMessage;

          handleMessage(parsed, ws);
        } catch (error) {
          console.error("[Bridge] Failed to parse message:", error);
        }
      },

      close(ws, code, reason) {
        console.error(`[Bridge] WebSocket closed: ${code} ${reason}`);

        if (connection?.ws === ws) {
          connection = null;

          // Reject all pending requests
          for (const [id, pending] of pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error("Connection lost"));
            pendingRequests.delete(id);
          }
        }
      },
    },
  });

  function handleMessage(
    message: BridgeMessage,
    ws: ServerWebSocket<WebSocketData>,
  ) {
    if ((message as { type: string }).type === "handshake") {
      // Handle handshake from plugin
      const params = (message as BridgeRequest).params;
      if (connection && connection.ws === ws && params) {
        connection.pluginVersion =
          (params.pluginVersion as string) || "unknown";
        console.error(
          `[Bridge] Plugin connected, version: ${connection.pluginVersion}`,
        );
      }
      return;
    }

    if (message.type === "response") {
      const response = message as BridgeResponse;
      const pending = pendingRequests.get(response.id);

      if (pending) {
        clearTimeout(pending.timeout);
        pendingRequests.delete(response.id);
        pending.resolve(response);
      }
      return;
    }

    if (message.type === "event") {
      // Forward events to registered handlers
      for (const handler of eventHandlers) {
        try {
          handler(message);
        } catch (err) {
          console.error("[Bridge] Event handler error:", err);
        }
      }
      return;
    }
  }

  function sendRequest(
    method: string,
    params: Record<string, unknown>,
  ): Promise<BridgeResponse> {
    return new Promise((resolve, reject) => {
      if (!connection) {
        reject(new Error("Plugin not connected"));
        return;
      }

      const id = crypto.randomUUID();

      const request: BridgeRequest = {
        id,
        type: "request",
        method,
        params,
        timestamp: Date.now(),
      };

      const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, REQUEST_TIMEOUT_MS);

      pendingRequests.set(id, { resolve, reject, timeout });

      try {
        connection.ws.send(JSON.stringify(request));
      } catch (error) {
        clearTimeout(timeout);
        pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  function isConnected(): boolean {
    return connection !== null;
  }

  function shutdown(): void {
    // Reject all pending requests
    for (const [id, pending] of pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Bridge shutting down"));
      pendingRequests.delete(id);
    }

    // Close connection
    if (connection) {
      connection.ws.close(1000, "Server shutting down");
      connection = null;
    }

    // Stop the server
    server.stop();
  }

  function onEvent(handler: (event: BridgeMessage) => void): void {
    eventHandlers.push(handler);
  }

  function getConnectionInfo() {
    return {
      connected: connection !== null,
      pluginVersion: connection?.pluginVersion,
      connectedAt: connection?.connectedAt,
    };
  }

  console.error(`[Bridge] WebSocket server started on ws://localhost:${port}`);

  return {
    sendRequest,
    isConnected,
    shutdown,
    onEvent,
    getConnectionInfo,
  };
}
