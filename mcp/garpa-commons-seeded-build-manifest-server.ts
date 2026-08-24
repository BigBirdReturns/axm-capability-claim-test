#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsSeededBuildManifestTools } from "./garpaCommonsSeededBuildManifestTools.ts";

const server = new McpServer({
  name: "garpa-commons-seeded-build-manifest",
  version: "0.8.0",
});

registerGarpaCommonsSeededBuildManifestTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
