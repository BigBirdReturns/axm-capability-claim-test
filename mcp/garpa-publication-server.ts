#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaPublicationTools } from "./garpaPublicationTools.ts";

const server = new McpServer({
  name: "garpa-publication",
  version: "0.1.0",
});

registerGarpaPublicationTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
