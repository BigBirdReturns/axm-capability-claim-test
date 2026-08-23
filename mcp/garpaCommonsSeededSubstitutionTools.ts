import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateCommonsSeededSubstitutionRequest } from "../app/src/lib/garpa/validateCommonsSeededSubstitution.ts";
import { runCommonsSeededSubstitutionGate } from "../app/src/lib/garpa/runCommonsSeededSubstitutionGate.ts";
import { renderCommonsSeededSubstitutionMarkdown } from "../app/src/lib/garpa/renderCommonsSeededSubstitution.ts";

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

export function registerGarpaCommonsSeededSubstitutionTools(
  server: McpServer,
): void {
  server.registerTool(
    "validate_garpa_commons_seeded_substitution",
    {
      title: "Validate a GARPA Commons-seeded substitution request",
      description:
        "Validates the component-projection request, exact projection-result digest envelope, target claim packet, target capability graph references, and complete SubstitutionPlan shape. Validation does not admit the plan.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const result = validateCommonsSeededSubstitutionRequest(request);
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "run_garpa_commons_seeded_substitution",
    {
      title: "Run a GARPA Commons-seeded substitution plan",
      description:
        "Recomputes Commons component projection, checks the projection-result digest, requires every seeded component to remain byte-semantically identical, and delegates all target-only components, compatibility edges, options, availability, prices, licenses, and cost boundaries to the existing target substitution gate. The tool returns admitted, incomplete, or blocked state and never emits an architecture.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsSeededSubstitutionRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = runCommonsSeededSubstitutionGate(validated.value);
      return text({
        ok: true,
        substitutionBlocked: result.state === "seeded_substitution_blocked",
        admittedForArchitecture: result.passed,
        result,
        markdown: renderCommonsSeededSubstitutionMarkdown(
          validated.value,
          result,
        ),
      });
    },
  );
}
