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
import { registerGarpaRegistryTools } from "./garpaRegistryTools.ts";
import { registerGarpaCommonsTools } from "./garpaCommonsTools.ts";
import { registerGarpaCommonsCatalogTools } from "./garpaCommonsCatalogTools.ts";
import { registerGarpaCommonsTransferTools } from "./garpaCommonsTransferTools.ts";
import { registerGarpaCommonsProjectionTools } from "./garpaCommonsProjectionTools.ts";
import { registerGarpaCommonsSeededSubstitutionTools } from "./garpaCommonsSeededSubstitutionTools.ts";
import { registerGarpaCommonsSeededArchitectureTools } from "./garpaCommonsSeededArchitectureTools.ts";
import { registerGarpaCommonsSeededQualificationTools } from "./garpaCommonsSeededQualificationTools.ts";
import { registerGarpaCommonsSeededBuildManifestTools } from "./garpaCommonsSeededBuildManifestTools.ts";
import { registerGarpaCommonsSeededBuildReceiptTools } from "./garpaCommonsSeededBuildReceiptTools.ts";
import { registerGarpaCommonsSeededPreflightTools } from "./garpaCommonsSeededPreflightTools.ts";
import { registerGarpaCommonsSeededTestRunTools } from "./garpaCommonsSeededTestRunTools.ts";
import { registerGarpaCommonsSeededMissionEvaluationTools } from "./garpaCommonsSeededMissionEvaluationTools.ts";
import { registerGarpaCommonsSeededVendorParityTools } from "./garpaCommonsSeededVendorParityTools.ts";
import { registerGarpaCommonsSeededPublicationTools } from "./garpaCommonsSeededPublicationTools.ts";
import { registerGarpaCommonsSeededReleaseTools } from "./garpaCommonsSeededReleaseTools.ts";
import { registerGarpaCommonsSeededPublicRegistryTools } from "./garpaCommonsSeededPublicRegistryTools.ts";
import { registerGarpaCommonsSeededExternalDistributionTools } from "./garpaCommonsSeededExternalDistributionTools.ts";
import { registerGarpaMethodTools } from "./garpaMethodTools.ts";

const server = new McpServer({
  name: "garpa-complete",
  version: "1.7.0",
});

registerGarpaMethodTools(server);
registerGarpaCommonsSeededExternalDistributionTools(server);
registerGarpaCommonsSeededPublicRegistryTools(server);
registerGarpaCommonsSeededReleaseTools(server);
registerGarpaCommonsSeededPublicationTools(server);
registerGarpaCommonsSeededVendorParityTools(server);
registerGarpaCommonsSeededMissionEvaluationTools(server);
registerGarpaCommonsSeededTestRunTools(server);
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
registerGarpaRegistryTools(server);
registerGarpaCommonsTools(server);
registerGarpaCommonsCatalogTools(server);
registerGarpaCommonsTransferTools(server);
registerGarpaCommonsProjectionTools(server);
registerGarpaCommonsSeededSubstitutionTools(server);
registerGarpaCommonsSeededArchitectureTools(server);
registerGarpaCommonsSeededQualificationTools(server);
registerGarpaCommonsSeededBuildManifestTools(server);
registerGarpaCommonsSeededBuildReceiptTools(server);
registerGarpaCommonsSeededPreflightTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
