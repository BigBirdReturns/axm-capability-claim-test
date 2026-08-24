import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderCommonsSeededTestRunMarkdown } from "../app/src/lib/garpa/renderCommonsSeededTestRun.ts";
import { runCommonsSeededTestRunGate } from "../app/src/lib/garpa/runCommonsSeededTestRunGate.ts";
import { validateCommonsSeededTestRunRequest } from "../app/src/lib/garpa/validateCommonsSeededTestRun.ts";

const JSON_INPUT = z.union([z.string(), z.record(z.any())]);

function text(content: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof content === "string" ? content : JSON.stringify(content, null, 2),
      },
    ],
  };
}

export function registerGarpaCommonsSeededTestRunTools(
  server: McpServer,
): void {
  server.registerTool(
    "validate_garpa_commons_seeded_test_run",
    {
      title: "Validate a GARPA Commons-seeded test-run request",
      description:
        "Validates the admitted preflight request, digest-bound target TestRunReceipt, exact reservation, scenario, as-built and qualification custody, operators, fixture, environment, metrics, raw artifacts, interventions, anomalies, aborts, and false transfer and mission-equivalence claims. Validation does not evaluate mission adequacy.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const result = validateCommonsSeededTestRunRequest(request);
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "run_garpa_commons_seeded_test_run",
    {
      title: "Run the GARPA Commons-seeded test-run receipt gate",
      description:
        "Recomputes preflight, binds one exact reserved target run to the as-built system, frozen scenario, configuration, operators, fixtures, environment, required metrics, samples, raw-data custody, interventions, anomalies, and abort state. A coherent pass, failure, abort, or invalidation may be admitted as a receipt. Admission is not mission success, vendor parity, deployment authority, or publication authority.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsSeededTestRunRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = runCommonsSeededTestRunGate(validated.value);
      return text({
        ok: true,
        testRunBlocked: result.state === "seeded_test_run_blocked",
        receiptAdmitted: result.passed,
        result,
        markdown: renderCommonsSeededTestRunMarkdown(validated.value, result),
      });
    },
  );
}
