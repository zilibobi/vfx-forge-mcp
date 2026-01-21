# VFX Forge MCP Server

An MCP (Model Context Protocol) server that enables AI agents to interact with the VFX Forge Roblox plugin for creating and manipulating visual effects.

## Overview

This project provides a bridge between AI agents (like Claude) and the VFX Forge plugin running in Roblox Studio. It allows agents to:

- Explore and query the Roblox DataModel hierarchy
- Create, modify, and delete instances
- Manipulate properties and attributes
- Partially use some of the VFX Forge tools/features
- Access Roblox API documentation offline

The MCP server communicates with AI agents via the standard MCP protocol (stdio), and with the VFX Forge plugin via WebSocket for real-time bidirectional communication.

## Installation

### Automatic Setup
Not available yet

### Local Setup

1. Install dependencies:

```bash
cd vfx-forge-mcp
bun install
```

2. Configure your MCP client to use this server. For Claude Desktop, add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vfx-forge": {
      "command": "bun",
      "args": ["run", "/path/to/vfx-forge-mcp/src/index.ts"],
      "env": {
        "VFX_FORGE_PORT": "3847"
      }
    }
  }
}
```

3. Enable the MCP bridge in VFX Forge plugin settings within Roblox Studio.

## Running

```bash
# Start the server
bun run start

# Development mode with hot reload
bun run dev

# Type checking
bun run typecheck
```

## Health Check

The WebSocket server exposes a health endpoint at `http://localhost:3847/health`:

```json
{
  "status": "ok",
  "connected": true,
  "pendingRequests": 0,
  "pluginVersion": "1.0.0",
  "uptime": 12345
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VFX_FORGE_PORT` | `3847` | Port for the WebSocket server |
