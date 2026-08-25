#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsSeededExternalDistributionTools } from "./garpaCommonsSeededExternalDistributionTools.ts";

const server = new McpServer({
  name: "garpa-commons-seeded-external-distribution",
  version: "1.7.0",
});

registerGarpaCommonsSeededExternalDistributionTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
