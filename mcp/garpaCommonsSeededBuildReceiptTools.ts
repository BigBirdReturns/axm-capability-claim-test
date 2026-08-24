import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderCommonsSeededBuildReceiptMarkdown } from "../app/src/lib/garpa/renderCommonsSeededBuildReceipt.ts";
import { runCommonsSeededBuildReceiptGate } from "../app/src/lib/garpa/runCommonsSeededBuildReceiptGate.ts";
import { validateCommonsSeededBuildReceiptRequest } from "../app/src/lib/garpa/validateCommonsSeededBuildReceipt.ts";

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

export function registerGarpaCommonsSeededBuildReceiptTools(
  server: McpServer,
): void {
  server.registerTool(
    "validate_garpa_commons_seeded_build_receipt",
    {
      title: "Validate a GARPA Commons-seeded as-built receipt",
      description:
        "Validates the complete Commons-seeded build-manifest request and a content-addressed as-built receipt carrying installed identities, serial or lot custody, firmware, configuration, calibration, assembly, substitutions, deviations, actual costs, labor, and immutable artifacts. Validation does not admit the build for preflight.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const result = validateCommonsSeededBuildReceiptRequest(request);
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "run_garpa_commons_seeded_build_receipt",
    {
      title: "Run the GARPA Commons-seeded as-built receipt gate",
      description:
        "Recomputes the seeded build-manifest result, verifies the exact frozen chain, compares every installed component and code package against the manifest, requires serial or lot custody, passing calibration and assembly receipts, governed substitutions and deviations, complete actual cost and labor evidence, and immutable artifact resolution. Passing admits the exact assembled target for preflight only. It does not transfer qualification, authorize a test run, or establish mission equivalence.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsSeededBuildReceiptRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = runCommonsSeededBuildReceiptGate(validated.value);
      return text({
        ok: true,
        buildReceiptBlocked: result.state === "seeded_build_receipt_blocked",
        admittedForPreflight: result.passed,
        result,
        markdown: renderCommonsSeededBuildReceiptMarkdown(
          validated.value,
          result,
        ),
      });
    },
  );
}
