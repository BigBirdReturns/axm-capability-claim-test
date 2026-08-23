import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GARPA_METHOD_VERSION } from "../app/src/lib/garpa/garpaVersion.ts";

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

export function registerGarpaMethodTools(server: McpServer): void {
  server.registerTool(
    "describe_garpa_method",
    {
      title: "Describe the GARPA method surface",
      description:
        "Returns the implemented GARPA method version and the highest governed stage available in this server.",
      inputSchema: {},
    },
    async () =>
      text(
        JSON.stringify(
          {
            methodVersion: GARPA_METHOD_VERSION,
            highestStage: "custodied_mission_evaluation",
            physicalExecutionAutomatic: false,
          },
          null,
          2,
        ),
      ),
  );
}
