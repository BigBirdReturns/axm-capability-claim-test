import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateCommonsComponentProjectionRequest } from "../app/src/lib/garpa/validateCommonsComponentProjection.ts";
import { runCommonsComponentProjectionGate } from "../app/src/lib/garpa/runCommonsComponentProjectionGate.ts";
import { renderCommonsComponentProjectionMarkdown } from "../app/src/lib/garpa/renderCommonsComponentProjection.ts";

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

export function registerGarpaCommonsProjectionTools(server: McpServer): void {
  server.registerTool(
    "validate_garpa_commons_component_projection",
    {
      title: "Validate a GARPA Commons component-projection request",
      description:
        "Validates the transfer request, target claim packet, exact target ComponentCandidate shapes, target function and interface references, evidence references, projection identities, and transfer-result digest envelope. Validation does not admit a candidate.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const result = validateCommonsComponentProjectionRequest(request);
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "run_garpa_commons_component_projection",
    {
      title: "Project admitted Commons component observations into target candidates",
      description:
        "Recomputes Commons transfer, verifies the transfer-result digest, and projects only admitted exact-version component observations whose target case supplies its own identity, performance, availability, price, and licensing evidence. Source residuals, limitations, firmware boundary, mismatches, and requalification tests must remain attached. The output is a substitution seed, not an admitted option, compatibility result, architecture, qualification, or equivalence claim.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsComponentProjectionRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = runCommonsComponentProjectionGate(validated.value);
      return text({
        ok: true,
        projectionBlocked: result.state === "projection_blocked",
        result,
        markdown: renderCommonsComponentProjectionMarkdown(validated.value, result),
      });
    },
  );
}
