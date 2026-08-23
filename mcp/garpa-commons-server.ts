#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsTools } from "./garpaCommonsTools.ts";
import { registerGarpaCommonsCatalogTools } from "./garpaCommonsCatalogTools.ts";
import { registerGarpaCommonsTransferTools } from "./garpaCommonsTransferTools.ts";

const server = new McpServer({
  name: "garpa-capability-commons",
  version: "0.3.0",
});

registerGarpaCommonsTools(server);
registerGarpaCommonsCatalogTools(server);
registerGarpaCommonsTransferTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
