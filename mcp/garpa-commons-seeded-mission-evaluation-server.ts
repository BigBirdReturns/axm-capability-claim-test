#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaCommonsSeededMissionEvaluationTools } from "./garpaCommonsSeededMissionEvaluationTools.ts";

const server = new McpServer({
  name: "garpa-commons-seeded-mission-evaluation",
  version: "1.2.0",
});
registerGarpaCommonsSeededMissionEvaluationTools(server);
await server.connect(new StdioServerTransport());
