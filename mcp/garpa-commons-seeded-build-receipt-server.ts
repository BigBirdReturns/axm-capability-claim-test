#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsSeededBuildReceiptTools } from "./garpaCommonsSeededBuildReceiptTools.ts";

const server = new McpServer({
  name: "garpa-commons-seeded-build-receipt",
  version: "0.9.0",
});

registerGarpaCommonsSeededBuildReceiptTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
