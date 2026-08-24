#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsSeededPreflightTools } from "./garpaCommonsSeededPreflightTools.ts";

const server = new McpServer({
  name: "garpa-commons-seeded-preflight",
  version: "0.10.0",
});

registerGarpaCommonsSeededPreflightTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
