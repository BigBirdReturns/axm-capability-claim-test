#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsSeededQualificationTools } from "./garpaCommonsSeededQualificationTools.ts";

const server = new McpServer({
  name: "garpa-commons-seeded-qualification",
  version: "0.7.0",
});

registerGarpaCommonsSeededQualificationTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
