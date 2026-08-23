#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsSeededSubstitutionTools } from "./garpaCommonsSeededSubstitutionTools.ts";

const server = new McpServer({
  name: "garpa-commons-seeded-substitution",
  version: "0.5.0",
});

registerGarpaCommonsSeededSubstitutionTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
