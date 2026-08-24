#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsSeededReleaseTools } from "./garpaCommonsSeededReleaseTools.ts";

const server = new McpServer({
  name: "garpa-commons-seeded-release",
  version: "1.5.0",
});

registerGarpaCommonsSeededReleaseTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
