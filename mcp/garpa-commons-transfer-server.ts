#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsTransferTools } from "./garpaCommonsTransferTools.ts";

const server = new McpServer({
  name: "garpa-commons-case-transfer",
  version: "0.3.0",
});

registerGarpaCommonsTransferTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
