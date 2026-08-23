#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaExecutionTools } from "./garpaExecutionTools.ts";

const server = new McpServer({
  name: "garpa-execution",
  version: "0.1.0",
});

registerGarpaExecutionTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
