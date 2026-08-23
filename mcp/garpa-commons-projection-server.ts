#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsProjectionTools } from "./garpaCommonsProjectionTools.ts";

const server = new McpServer({
  name: "garpa-commons-component-projection",
  version: "0.4.0",
});

registerGarpaCommonsProjectionTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
