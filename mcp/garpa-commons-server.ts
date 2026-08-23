#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsTools } from "./garpaCommonsTools.ts";

const server = new McpServer({
  name: "garpa-capability-commons",
  version: "0.1.0",
});

registerGarpaCommonsTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
