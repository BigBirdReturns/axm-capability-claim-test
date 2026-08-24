import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderCommonsSeededPreflightMarkdown } from "../app/src/lib/garpa/renderCommonsSeededPreflight.ts";
import { runCommonsSeededPreflightGate } from "../app/src/lib/garpa/runCommonsSeededPreflightGate.ts";
import { validateCommonsSeededPreflightRequest } from "../app/src/lib/garpa/validateCommonsSeededPreflight.ts";

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

export function registerGarpaCommonsSeededPreflightTools(
  server: McpServer,
): void {
  server.registerTool(
    "validate_garpa_commons_seeded_preflight",
    {
      title: "Validate a GARPA Commons-seeded preflight request",
      description:
        "Validates the complete Commons-seeded as-built request plus a digest-bound preflight receipt covering exact fixtures, instrumentation, calibration, storage, clocks, operators, authorizations, hazards, abort controls, run reservations, and immutable evidence. Validation does not authorize execution.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const result = validateCommonsSeededPreflightRequest(request);
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "run_garpa_commons_seeded_preflight",
    {
      title: "Run the GARPA Commons-seeded preflight gate",
      description:
        "Recomputes the admitted as-built result, verifies the exact installed-state and qualification chain, checks frozen fixture, build-manifest instrumentation configuration, qualification identity, calibration, clock, storage, operator, authority, hazard, abort, evidence chronology, and unique run reservations, then delegates terminal readiness to the ordinary preflight gate. Passing authorizes only the reserved target execution. It is not a test result or mission-equivalence claim.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsSeededPreflightRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = runCommonsSeededPreflightGate(validated.value);
      return text({
        ok: true,
        preflightBlocked: result.state === "seeded_preflight_blocked",
        admittedForReservedExecution: result.passed,
        result,
        markdown: renderCommonsSeededPreflightMarkdown(
          validated.value,
          result,
        ),
      });
    },
  );
}
