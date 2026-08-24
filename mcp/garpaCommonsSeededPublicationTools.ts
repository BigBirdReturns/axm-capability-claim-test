import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderCommonsSeededPublicationMarkdown } from "../app/src/lib/garpa/renderCommonsSeededPublication.ts";
import { runCommonsSeededPublicationGate } from "../app/src/lib/garpa/runCommonsSeededPublicationGate.ts";
import { validateCommonsSeededPublicationRequest } from "../app/src/lib/garpa/validateCommonsSeededPublication.ts";

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

export function registerGarpaCommonsSeededPublicationTools(
  server: McpServer,
): void {
  server.registerTool(
    "validate_garpa_commons_seeded_publication",
    {
      title: "Validate a GARPA Commons-seeded publication request",
      description:
        "Validates the admitted vendor-parity chain, deterministic public-claim package, case index, upstream digest set, rights and safety reviews, audience, redactions, artifact ledger, chronology, and false equivalence, deployment, release, and public-release assertions. Validation does not determine publication readiness.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const result = validateCommonsSeededPublicationRequest(request);
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "run_garpa_commons_seeded_publication",
    {
      title: "Run the GARPA Commons-seeded publication-custody gate",
      description:
        "Recomputes vendor parity, regenerates every mission, residual, and parity claim, verifies exact support and limitation coordinates and artifact custody, and delegates publication readiness to the existing publication gate. A coherent publication-ready or blocked package may be admitted as a record. Admission does not establish immutable release, registry currency, deployment authority, or unrestricted equivalence.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsSeededPublicationRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = runCommonsSeededPublicationGate(validated.value);
      return text({
        ok: true,
        publicationCustodyBlocked:
          result.state === "seeded_publication_blocked",
        publicationRecordAdmitted: result.passed,
        publicationReady: result.publicationReady,
        publicationState: result.publicationState,
        result,
        markdown: renderCommonsSeededPublicationMarkdown(
          validated.value,
          result,
        ),
      });
    },
  );
}
