#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsSeededTestRunTools } from "./garpaCommonsSeededTestRunTools.ts";

const server = new McpServer({
  name: "garpa-commons-seeded-test-run",
  version: "1.1.0",
});

registerGarpaCommonsSeededTestRunTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
