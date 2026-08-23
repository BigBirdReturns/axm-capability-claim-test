#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsSeededArchitectureTools } from "./garpaCommonsSeededArchitectureTools.ts";

const server = new McpServer({
  name: "garpa-commons-seeded-architecture",
  version: "0.6.0",
});

registerGarpaCommonsSeededArchitectureTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
