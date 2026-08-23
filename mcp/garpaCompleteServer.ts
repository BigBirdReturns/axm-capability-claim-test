#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGarpaAdmissionTools } from "./garpaAdmissionTools.ts";
import { registerGarpaCapabilityTools } from "./garpaCapabilityTools.ts";
import { registerGarpaSubstitutionTools } from "./garpaSubstitutionTools.ts";
import { registerGarpaArchitectureTools } from "./garpaArchitectureTools.ts";
import { registerGarpaQualificationTools } from "./garpaQualificationTools.ts";
import { registerGarpaBuildManifestTools } from "./garpaBuildManifestTools.ts";
import { registerGarpaExecutionTools } from "./garpaExecutionTools.ts";
import { registerGarpaEvaluationTools } from "./garpaEvaluationTools.ts";
import { registerGarpaCustodiedEvaluationTools } from "./garpaCustodiedEvaluationTools.ts";
import { registerGarpaPublicationTools } from "./garpaPublicationTools.ts";
import { registerGarpaReleaseTools } from "./garpaReleaseTools.ts";
import { registerGarpaMethodTools } from "./garpaMethodTools.ts";

const server = new McpServer({
  name: "garpa-complete",
  version: "0.1.0",
});

registerGarpaMethodTools(server);
registerGarpaAdmissionTools(server);
registerGarpaCapabilityTools(server);
registerGarpaSubstitutionTools(server);
registerGarpaArchitectureTools(server);
registerGarpaQualificationTools(server);
registerGarpaBuildManifestTools(server);
registerGarpaExecutionTools(server);
registerGarpaEvaluationTools(server);
registerGarpaCustodiedEvaluationTools(server);
registerGarpaPublicationTools(server);
registerGarpaReleaseTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
