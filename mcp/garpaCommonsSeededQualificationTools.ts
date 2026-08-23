import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateCommonsSeededQualificationRequest } from "../app/src/lib/garpa/validateCommonsSeededQualification.ts";
import { runCommonsSeededQualificationGate } from "../app/src/lib/garpa/runCommonsSeededQualificationGate.ts";
import { renderCommonsSeededQualificationMarkdown } from "../app/src/lib/garpa/renderCommonsSeededQualification.ts";

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

export function registerGarpaCommonsSeededQualificationTools(
  server: McpServer,
): void {
  server.registerTool(
    "validate_garpa_commons_seeded_qualification",
    {
      title: "Validate a GARPA Commons-seeded qualification request",
      description:
        "Validates the seeded-architecture request, target mission outcome, frozen qualification contract, exact source and architecture-selection bindings, risk and residual custody, target scenario and metric closures, and freeze-time envelope. Validation does not admit qualification.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const result = validateCommonsSeededQualificationRequest(request);
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "run_garpa_commons_seeded_qualification",
    {
      title: "Run a GARPA Commons-seeded qualification contract",
      description:
        "Recomputes seeded architecture, verifies its result digest, binds the canonical target mission and architecture, preserves exact Commons source and selected-component custody, maps every source-required requalification test into target scenarios and metrics under the target environment, and delegates substantive admission to the existing qualification gate. It does not transfer source results or authorize procurement, assembly, physical execution, deployment, parity, or publication.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsSeededQualificationRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = runCommonsSeededQualificationGate(validated.value);
      return text({
        ok: true,
        qualificationBlocked: result.state === "seeded_qualification_blocked",
        admittedForBuildManifest: result.passed,
        result,
        markdown: renderCommonsSeededQualificationMarkdown(
          validated.value,
          result,
        ),
      });
    },
  );
}
