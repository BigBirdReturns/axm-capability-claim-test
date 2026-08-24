#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsSeededVendorParityTools } from "./garpaCommonsSeededVendorParityTools.ts";

const server = new McpServer({
  name: "garpa-commons-seeded-vendor-parity",
  version: "1.3.0",
});

registerGarpaCommonsSeededVendorParityTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
