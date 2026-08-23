import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateCommonsComponentProjectionRequest } from "../app/src/lib/garpa/validateCommonsProjection.ts";
import { runCommonsComponentProjectionGate } from "../app/src/lib/garpa/runCommonsProjectionGate.ts";
import { renderCommonsComponentProjectionMarkdown } from "../app/src/lib/garpa/renderCommonsProjection.ts";

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
      title: "Validate a GARPA Commons component projection request",
      description:
        "Validates a content-addressed Commons catalog, an exact compatibility-admission receipt, and target-only component evidence. Source-case price, availability, license, security, performance, and operating assumptions are not accepted as target evidence.",
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
      title: "Project a compatibility-admitted Commons observation into a target component candidate",
      description:
        "Projects exact identity and target graph mappings into the existing ComponentCandidate contract while withholding unsupported source-case fields. Returns component_candidate or substitution_ready. It never assigns target locally_qualified maturity and cannot satisfy the substitution gate by projection alone.",
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
        projectionBlocked: !result.passed,
        result,
        markdown: renderCommonsComponentProjectionMarkdown(validated.value, result),
      });
    },
  );
}
