#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsTools } from "./garpaCommonsTools.ts";
import { registerGarpaCommonsCatalogTools } from "./garpaCommonsCatalogTools.ts";

const server = new McpServer({
  name: "garpa-capability-commons",
  version: "0.2.0",
});

registerGarpaCommonsTools(server);
registerGarpaCommonsCatalogTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
