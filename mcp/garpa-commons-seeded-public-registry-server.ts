#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsSeededPublicRegistryTools } from "./garpaCommonsSeededPublicRegistryTools.ts";

const server = new McpServer({
  name: "garpa-commons-seeded-public-registry",
  version: "1.6.0",
});

registerGarpaCommonsSeededPublicRegistryTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
