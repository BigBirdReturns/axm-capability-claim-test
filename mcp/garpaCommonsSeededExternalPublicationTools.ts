import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderCommonsSeededExternalPublicationMarkdown } from "../app/src/lib/garpa/renderCommonsSeededExternalPublication.ts";
import { runCommonsSeededExternalPublicationGate } from "../app/src/lib/garpa/runCommonsSeededExternalPublicationGate.ts";
import { validateCommonsSeededExternalPublicationRequest } from "../app/src/lib/garpa/validateCommonsSeededExternalPublication.ts";

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

export function registerGarpaCommonsSeededExternalPublicationTools(
  server: McpServer,
): void {
  server.registerTool(
    "validate_garpa_commons_seeded_external_publication",
    {
      title:
        "Validate a GARPA Commons-seeded external-publication receipt",
      description:
        "Validates the exact public-registry predecessor, external receipt, captured bytes, artifact ledger, event semantics, digest envelope, and chronology. Synthetic qualification receipts must remain visibly synthetic and cannot assert a real event.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const result =
        validateCommonsSeededExternalPublicationRequest(request);
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "run_garpa_commons_seeded_external_publication",
    {
      title: "Run the GARPA Commons-seeded external-publication gate",
      description:
        "Recomputes the complete registry and release chain, verifies exact receipt and capture custody, delegates event semantics to the ordinary external-publication receipt gate, and preserves whether evidence is synthetic qualification or an observed external event. Admission does not authorize deployment or unrestricted equivalence.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated =
        validateCommonsSeededExternalPublicationRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = runCommonsSeededExternalPublicationGate(
        validated.value,
      );
      return text({
        ok: true,
        receiptBlocked:
          result.state === "seeded_external_publication_blocked",
        receiptAdmitted: result.receiptAdmitted,
        externalEventObserved: result.externalEventObserved,
        evidenceClass: result.evidenceClass,
        eventKind: result.eventKind,
        publicRegistryPublished: result.publicRegistryPublished,
        publicReleaseOccurred: result.publicReleaseOccurred,
        result,
        markdown: renderCommonsSeededExternalPublicationMarkdown(
          validated.value,
          result,
        ),
      });
    },
  );
}
