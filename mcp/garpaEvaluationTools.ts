import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateTestRunReceipt } from "../app/src/lib/garpa/validateExecutionReceipts.ts";
import { evaluateMissionAdequacy } from "../app/src/lib/garpa/evaluateMissionAdequacy.ts";
import type { TestRunReceipt } from "../app/src/types/garpaExecution.ts";

const JSON_INPUT = z.union([z.string(), z.record(z.any())]);

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

export function registerGarpaEvaluationTools(server: McpServer): void {
  server.registerTool(
    "evaluate_garpa_mission_adequacy",
    {
      title: "Evaluate GARPA mission adequacy",
      description:
        "Evaluates only current valid test-run receipts against a frozen build digest, qualification-contract digest, required scenarios, and non-compensatory essential metrics. Returns matched, bounded_match, partial, failed, incomparable, or unassessed with residuals and a falsification line.",
      inputSchema: {
        scope: z.object({
          caseId: z.string().min(1),
          qualificationContractDigest: z.string().min(1),
          buildDigest: z.string().min(1),
          requiredScenarioIds: z.array(z.string().min(1)),
          essentialMetricIds: z.array(z.string().min(1)),
          secondaryMetricIds: z.array(z.string().min(1)),
          fullMissionBoundary: z.boolean(),
          boundaryDescription: z.string(),
        }),
        testRunReceipts: z.array(JSON_INPUT),
      },
    },
    async ({ scope, testRunReceipts }) => {
      const receipts: TestRunReceipt[] = [];
      const errors: string[] = [];
      testRunReceipts.forEach((receipt, index) => {
        const result = validateTestRunReceipt(receipt);
        if (!result.ok || !result.value) {
          errors.push(
            ...result.errors.map(
              (error) => `testRunReceipts.${index}: ${error}`,
            ),
          );
          return;
        }
        receipts.push(result.value);
      });
      if (errors.length > 0) {
        return text(
          JSON.stringify(
            {
              ok: false,
              stage: "test_run_receipts",
              errors,
            },
            null,
            2,
          ),
        );
      }
      const evaluation = evaluateMissionAdequacy({
        scope,
        testRunReceipts: receipts,
      });
      return text(
        JSON.stringify(
          {
            ok: true,
            evaluation,
          },
          null,
          2,
        ),
      );
    },
  );
}
