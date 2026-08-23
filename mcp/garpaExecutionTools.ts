import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  validateBuildReceipt,
  validateTestRunReceipt,
} from "../app/src/lib/garpa/validateExecutionReceipts.ts";
import { runPreflightGate } from "../app/src/lib/garpa/runPreflightGate.ts";

const JSON_INPUT = z.union([z.string(), z.record(z.any())]);

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

export function registerGarpaExecutionTools(server: McpServer): void {
  server.registerTool(
    "validate_garpa_build_receipt",
    {
      title: "Validate a GARPA build receipt",
      description:
        "Validates the exact installed hardware, software, code, substitutions, deviations, actual costs, labor, artifacts, and digest of an executed GARPA build.",
      inputSchema: {
        buildReceipt: JSON_INPUT.describe("Build receipt object or JSON string."),
      },
    },
    async ({ buildReceipt }) => {
      const result = validateBuildReceipt(buildReceipt);
      return text(
        JSON.stringify(
          {
            ok: result.ok,
            errors: result.errors,
            buildReceipt: result.value,
          },
          null,
          2,
        ),
      );
    },
  );

  server.registerTool(
    "validate_garpa_test_run_receipt",
    {
      title: "Validate a GARPA test-run receipt",
      description:
        "Validates one immutable execution receipt, including configuration, fixture, raw-data custody, metric calculations, interventions, anomalies, aborts, and result digest.",
      inputSchema: {
        testRunReceipt: JSON_INPUT.describe("Test-run receipt object or JSON string."),
      },
    },
    async ({ testRunReceipt }) => {
      const result = validateTestRunReceipt(testRunReceipt);
      return text(
        JSON.stringify(
          {
            ok: result.ok,
            errors: result.errors,
            testRunReceipt: result.value,
          },
          null,
          2,
        ),
      );
    },
  );

  server.registerTool(
    "run_garpa_preflight_gate",
    {
      title: "Run the GARPA test preflight gate",
      description:
        "Refuses test execution unless the assembled build matches the current manifest and qualification contract, material deviations are closed, and all fixture, instrumentation, authority, hazard, abort, operator, storage, clock, and run-identity controls are ready.",
      inputSchema: {
        expectedManifestDigest: z.string().min(1),
        expectedQualificationContractDigest: z.string().min(1),
        buildReceipt: JSON_INPUT.describe("Build receipt object or JSON string."),
        readiness: z.object({
          fixtureReady: z.boolean(),
          instrumentationReady: z.boolean(),
          calibrationReady: z.boolean(),
          storageReady: z.boolean(),
          clocksReady: z.boolean(),
          authorityReady: z.boolean(),
          hazardControlsReady: z.boolean(),
          abortPathReady: z.boolean(),
          operatorRolesReady: z.boolean(),
          runIdReserved: z.boolean(),
        }),
      },
    },
    async ({
      expectedManifestDigest,
      expectedQualificationContractDigest,
      buildReceipt,
      readiness,
    }) => {
      const validation = validateBuildReceipt(buildReceipt);
      if (!validation.ok || !validation.value) {
        return text(
          JSON.stringify(
            {
              ok: false,
              stage: "build_receipt",
              errors: validation.errors,
            },
            null,
            2,
          ),
        );
      }
      const preflight = runPreflightGate({
        expectedManifestDigest,
        expectedQualificationContractDigest,
        buildReceipt: validation.value,
        readiness,
      });
      return text(
        JSON.stringify(
          {
            ok: true,
            preflightBlocked: !preflight.passed,
            preflight,
          },
          null,
          2,
        ),
      );
    },
  );
}
