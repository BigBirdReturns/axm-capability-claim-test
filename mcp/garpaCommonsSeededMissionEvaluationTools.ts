import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderCommonsSeededMissionEvaluationMarkdown } from "../app/src/lib/garpa/renderCommonsSeededMissionEvaluation.ts";
import { runCommonsSeededMissionEvaluationGate } from "../app/src/lib/garpa/runCommonsSeededMissionEvaluationGate.ts";
import { validateCommonsSeededMissionEvaluationRequest } from "../app/src/lib/garpa/validateCommonsSeededMissionEvaluation.ts";

const JSON_INPUT = z.union([z.string(), z.record(z.any())]);

function text(content: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text:
          typeof content === "string"
            ? content
            : JSON.stringify(content, null, 2),
      },
    ],
  };
}

export function registerGarpaCommonsSeededMissionEvaluationTools(
  server: McpServer,
): void {
  server.registerTool(
    "validate_garpa_commons_seeded_mission_evaluation",
    {
      title: "Validate a GARPA Commons-seeded mission evaluation",
      description:
        "Validates the complete Commons-seeded test-run set, immutable evaluation envelope, and delegated custodied mission-evaluation arguments. Validation does not classify mission adequacy.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const result = validateCommonsSeededMissionEvaluationRequest(request);
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "run_garpa_commons_seeded_mission_evaluation",
    {
      title: "Run the GARPA Commons-seeded mission-evaluation gate",
      description:
        "Recomputes every Commons-seeded test-run result, verifies the exact complete run set and upstream custody, requires the delegated custodied evaluation to contain the same immutable receipts, and returns the existing evaluator's bounded mission state. Failed, aborted, invalidated, and incomplete executions remain visible. Passing does not establish vendor parity, deployment authority, or publication authority.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsSeededMissionEvaluationRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = runCommonsSeededMissionEvaluationGate(validated.value);
      return text({
        ok: true,
        evaluationBlocked:
          result.state === "seeded_mission_evaluation_blocked",
        evaluationAdmitted: result.passed,
        missionState: result.missionState,
        result,
        markdown: renderCommonsSeededMissionEvaluationMarkdown(
          validated.value,
          result,
        ),
      });
    },
  );
}
