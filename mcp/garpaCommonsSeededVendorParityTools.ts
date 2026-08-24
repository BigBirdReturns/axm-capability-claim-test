import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderCommonsSeededVendorParityMarkdown } from "../app/src/lib/garpa/renderCommonsSeededVendorParity.ts";
import { runCommonsSeededVendorParityGate } from "../app/src/lib/garpa/runCommonsSeededVendorParityGate.ts";
import { validateCommonsSeededVendorParityRequest } from "../app/src/lib/garpa/validateCommonsSeededVendorParity.ts";

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

export function registerGarpaCommonsSeededVendorParityTools(
  server: McpServer,
): void {
  server.registerTool(
    "validate_garpa_commons_seeded_vendor_parity",
    {
      title: "Validate a GARPA Commons-seeded vendor-parity request",
      description:
        "Validates the admitted mission-evaluation chain, ordinary vendor-parity request, exact vendor identity, digest-bound observation ledgers, content-addressed vendor artifacts, chronology, and false transfer, unrestricted-equivalence, deployment, and publication claims. Validation does not classify parity.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const result = validateCommonsSeededVendorParityRequest(request);
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "run_garpa_commons_seeded_vendor_parity",
    {
      title: "Run the GARPA Commons-seeded vendor-parity gate",
      description:
        "Recomputes the complete Commons-seeded mission evaluation, derives GARPA observations from every valid campaign run under the frozen aggregation methods, verifies the exact vendor evidence ledger, and delegates the substantive state to the existing vendor-parity evaluator. A coherent match, miss, missing baseline, evidence-only comparison, mismatch, incomparable state, or not-attempted state may be admitted as a record. Admission does not authorize unrestricted equivalence, deployment, or publication.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsSeededVendorParityRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = runCommonsSeededVendorParityGate(validated.value);
      return text({
        ok: true,
        parityBlocked: result.state === "seeded_vendor_parity_blocked",
        parityRecordAdmitted: result.passed,
        parityState: result.parityState,
        result,
        markdown: renderCommonsSeededVendorParityMarkdown(
          validated.value,
          result,
        ),
      });
    },
  );
}
