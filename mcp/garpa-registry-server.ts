#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaRegistryTools } from "./garpaRegistryTools.ts";

const server = new McpServer({
  name: "garpa-registry",
  version: "0.1.0",
});

registerGarpaRegistryTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
