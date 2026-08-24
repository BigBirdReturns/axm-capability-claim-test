import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderCommonsSeededPublicRegistryMarkdown } from "../app/src/lib/garpa/renderCommonsSeededPublicRegistry.ts";
import { runCommonsSeededPublicRegistryGate } from "../app/src/lib/garpa/runCommonsSeededPublicRegistryGate.ts";
import { validateCommonsSeededPublicRegistryRequest } from "../app/src/lib/garpa/validateCommonsSeededPublicRegistry.ts";

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

export function registerGarpaCommonsSeededPublicRegistryTools(
  server: McpServer,
): void {
  server.registerTool(
    "validate_garpa_commons_seeded_public_registry",
    {
      title: "Validate a GARPA Commons-seeded public-registry request",
      description:
        "Validates the exact verified release predecessor, deterministic initial registry entry, identity patch, ordinary registry update request, digest envelope, chronology, and false external-publication, distribution, deployment, and unrestricted-equivalence assertions. Validation does not apply the registry update.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const result = validateCommonsSeededPublicRegistryRequest(request);
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "run_garpa_commons_seeded_public_registry",
    {
      title: "Run the GARPA Commons-seeded public-registry gate",
      description:
        "Recomputes release custody, derives the exact empty initial case entry and manifest-bound identity patch, verifies every registry digest and transition, and delegates to the existing registry update and application gate. Admission establishes one governing release pointer inside the case record only; it does not establish external publication, distribution, deployment authority, or unrestricted equivalence.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsSeededPublicRegistryRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = runCommonsSeededPublicRegistryGate(validated.value);
      return text({
        ok: true,
        registryBlocked:
          result.state === "seeded_public_registry_blocked",
        registryRecordAdmitted: result.passed,
        registryUpdateApplied: result.registryUpdateApplied,
        registryState: result.registryState,
        result,
        markdown: renderCommonsSeededPublicRegistryMarkdown(
          validated.value,
          result,
        ),
      });
    },
  );
}
