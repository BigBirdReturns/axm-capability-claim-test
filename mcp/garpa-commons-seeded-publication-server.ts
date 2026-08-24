#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsSeededPublicationTools } from "./garpaCommonsSeededPublicationTools.ts";

const server = new McpServer({
  name: "garpa-commons-seeded-publication",
  version: "1.4.0",
});

registerGarpaCommonsSeededPublicationTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
