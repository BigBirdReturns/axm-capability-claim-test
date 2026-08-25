import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderCommonsSeededExternalDistributionMarkdown } from "../app/src/lib/garpa/renderCommonsSeededExternalDistribution.ts";
import { runCommonsSeededExternalDistributionGate } from "../app/src/lib/garpa/runCommonsSeededExternalDistributionGate.ts";
import { validateCommonsSeededExternalDistributionRequest } from "../app/src/lib/garpa/validateCommonsSeededExternalDistribution.ts";

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

export function registerGarpaCommonsSeededExternalDistributionTools(
  server: McpServer,
): void {
  server.registerTool(
    "validate_garpa_commons_seeded_external_distribution",
    {
      title:
        "Validate a GARPA Commons-seeded external-distribution request",
      description:
        "Validates the admitted public-registry predecessor, exact governing release bytes, content-addressed distribution evidence, fixture-versus-observed-event mode, chronology, event flags, and false deployment and unrestricted-equivalence assertions.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const result =
        validateCommonsSeededExternalDistributionRequest(
          request,
        );
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "run_garpa_commons_seeded_external_distribution",
    {
      title:
        "Run the GARPA Commons-seeded external-distribution gate",
      description:
        "Recomputes registry and release custody, verifies every externally observed release file and evidence artifact, admits a non-public qualification fixture without event assertions, and records an observed external event only when independently attributable platform and retrieval evidence agree.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated =
        validateCommonsSeededExternalDistributionRequest(
          request,
        );
      if (!validated.ok || !validated.value) {
        return text({
          ok: false,
          errors: validated.errors,
        });
      }
      const result =
        runCommonsSeededExternalDistributionGate(
          validated.value,
        );
      return text({
        ok: true,
        distributionBlocked:
          result.state ===
          "seeded_external_distribution_blocked",
        receiptAdmitted: result.receiptAdmitted,
        eventObserved: result.eventObserved,
        publicReleaseOccurred:
          result.publicReleaseOccurred,
        publicRegistryPublished:
          result.publicRegistryPublished,
        result,
        markdown:
          renderCommonsSeededExternalDistributionMarkdown(
            validated.value,
            result,
          ),
      });
    },
  );
}
