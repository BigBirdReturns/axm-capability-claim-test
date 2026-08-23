import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validatePreflightReceipt } from "../app/src/lib/garpa/validatePreflightReceipt.ts";
import { validateTestRunReceipt } from "../app/src/lib/garpa/validateExecutionReceipts.ts";
import { evaluateMissionAdequacyWithCustody } from "../app/src/lib/garpa/evaluateMissionAdequacyWithCustody.ts";
import type { PreflightReceipt } from "../app/src/types/garpaPreflight.ts";
import type { TestRunReceipt } from "../app/src/types/garpaExecution.ts";

const JSON_INPUT = z.union([z.string(), z.record(z.any())]);

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

export function registerGarpaCustodiedEvaluationTools(server: McpServer): void {
  server.registerTool(
    "validate_garpa_preflight_receipt",
    {
      title: "Validate a GARPA preflight receipt",
      description:
        "Validates that the recorded readiness state agrees with the gate result and that a passing preflight contains no blocking reasons.",
      inputSchema: {
        preflightReceipt: JSON_INPUT.describe("Preflight receipt object or JSON string."),
      },
    },
    async ({ preflightReceipt }) => {
      const result = validatePreflightReceipt(preflightReceipt);
      return text(
        JSON.stringify(
          {
            ok: result.ok,
            errors: result.errors,
            preflightReceipt: result.value,
          },
          null,
          2,
        ),
      );
    },
  );

  server.registerTool(
    "evaluate_garpa_mission_with_custody",
    {
      title: "Evaluate GARPA mission adequacy with execution custody",
      description:
        "Admits only test runs carrying a matching passing preflight receipt recorded before execution. Then evaluates current valid runs against the frozen build, qualification contract, scenarios, and non-compensatory essential metrics.",
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
        preflightReceipts: z.array(JSON_INPUT),
      },
    },
    async ({ scope, testRunReceipts, preflightReceipts }) => {
      const runs: TestRunReceipt[] = [];
      const preflights: PreflightReceipt[] = [];
      const errors: string[] = [];

      testRunReceipts.forEach((receipt, index) => {
        const result = validateTestRunReceipt(receipt);
        if (!result.ok || !result.value) {
          errors.push(...result.errors.map((error) => `testRunReceipts.${index}: ${error}`));
          return;
        }
        runs.push(result.value);
      });
      preflightReceipts.forEach((receipt, index) => {
        const result = validatePreflightReceipt(receipt);
        if (!result.ok || !result.value) {
          errors.push(...result.errors.map((error) => `preflightReceipts.${index}: ${error}`));
          return;
        }
        preflights.push(result.value);
      });

      if (errors.length > 0) {
        return text(
          JSON.stringify(
            { ok: false, stage: "execution_receipts", errors },
            null,
            2,
          ),
        );
      }

      const evaluation = evaluateMissionAdequacyWithCustody({
        scope,
        testRunReceipts: runs,
        preflightReceipts: preflights,
      });
      return text(JSON.stringify({ ok: true, evaluation }, null, 2));
    },
  );
}
