/**
 * VFX Forge MCP Server - Main Entry Point
 * Uses Bun runtime with native WebSocket support
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createBridge, type PluginBridge } from "./bridge/connection.js";
import {
  registerTools,
  handleToolCall,
  isPluginTool,
  type ServerContext,
} from "./tools/index.js";
import { loadRobloxDocs, type RobloxDocsCache } from "./docs/roblox-docs.js";

const SERVER_NAME = "vfx-forge-mcp";
const SERVER_VERSION = "0.1.0";
const DEFAULT_BRIDGE_PORT = 3847;

async function main() {
  const bridgePort = parseInt(
    process.env.VFX_FORGE_PORT ?? String(DEFAULT_BRIDGE_PORT),
    10,
  );

  console.error(`[${SERVER_NAME}] Starting MCP server v${SERVER_VERSION}`);
  console.error(
    `[${SERVER_NAME}] Plugin bridge will listen on ws://localhost:${bridgePort}`,
  );

  // Initialize MCP server
  const mcpServer = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Start WebSocket bridge for plugin communication
  let bridge: PluginBridge;
  try {
    bridge = await createBridge(bridgePort);
    console.error(
      `[${SERVER_NAME}] Plugin bridge started on ws://localhost:${bridgePort}`,
    );
  } catch (error) {
    console.error(`[${SERVER_NAME}] Failed to start plugin bridge:`, error);
    process.exit(1);
  }

  // Load Roblox documentation (async, non-blocking)
  let docs: RobloxDocsCache | null = null;
  loadRobloxDocs()
    .then((loadedDocs) => {
      docs = loadedDocs;
      console.error(
        `[${SERVER_NAME}] Roblox documentation loaded (version: ${docs.version})`,
      );
    })
    .catch((error) => {
      console.error(
        `[${SERVER_NAME}] Failed to load Roblox documentation:`,
        error,
      );
      console.error(`[${SERVER_NAME}] Documentation tools will be unavailable`);
    });

  // Register tools and get definitions
  const toolDefinitions = registerTools();

  // Handle tool listing
  mcpServer.server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: toolDefinitions };
  });

  // Handle tool calls
  mcpServer.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (isPluginTool(name) && !bridge.isConnected()) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: {
                  code: "CONNECTION_LOST",
                  message:
                    "VFX Forge plugin is not connected. Please ensure the plugin is running in Roblox Studio.",
                },
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    try {
      const context: ServerContext = { bridge, docs };
      const result = await handleToolCall(context, name, args ?? {});

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: {
                  code: "OPERATION_FAILED",
                  message: errorMessage,
                },
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  console.error(`[${SERVER_NAME}] MCP server connected and ready`);

  // Handle graceful shutdown
  const shutdown = async () => {
    console.error(`[${SERVER_NAME}] Shutting down...`);
    bridge.shutdown();
    await mcpServer.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Subscribe to plugin events
  bridge.onEvent((event) => {
    console.error(`[${SERVER_NAME}] Plugin event:`, event.type);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
