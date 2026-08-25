#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsSeededExternalPublicationTools } from "./garpaCommonsSeededExternalPublicationTools.ts";

const server = new McpServer({
  name: "garpa-commons-seeded-external-publication",
  version: "1.7.0",
});

registerGarpaCommonsSeededExternalPublicationTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
