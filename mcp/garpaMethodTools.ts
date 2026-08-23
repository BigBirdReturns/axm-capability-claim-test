import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GARPA_METHOD_VERSION } from "../app/src/lib/garpa/garpaVersion.ts";
import { IMPLEMENTED_GARPA_STAGES } from "../app/src/lib/garpa/implementedStages.ts";

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

export function registerGarpaMethodTools(server: McpServer): void {
  server.registerTool(
    "describe_garpa_method",
    {
      title: "Describe the GARPA method surface",
      description:
        "Returns the implemented GARPA method version, ordered governed stages, highest available stage, and the automatic physical-execution boundary.",
      inputSchema: {},
    },
    async () =>
      text(
        JSON.stringify(
          {
            methodVersion: GARPA_METHOD_VERSION,
            implementedStages: IMPLEMENTED_GARPA_STAGES,
            highestStage:
              IMPLEMENTED_GARPA_STAGES[IMPLEMENTED_GARPA_STAGES.length - 1],
            physicalExecutionAutomatic: false,
          },
          null,
          2,
        ),
      ),
  );
}
