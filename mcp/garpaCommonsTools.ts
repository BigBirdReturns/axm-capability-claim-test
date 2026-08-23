import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateCommonsAdmissionRequest } from "../app/src/lib/garpa/validateCommonsAdmission.ts";
import { runCommonsAdmissionGate } from "../app/src/lib/garpa/runCommonsAdmissionGate.ts";
import { renderCommonsAdmissionMarkdown } from "../app/src/lib/garpa/renderCommonsAdmission.ts";

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

export function registerGarpaCommonsTools(server: McpServer): void {
  server.registerTool(
    "validate_garpa_commons_admission",
    {
      title: "Validate a GARPA capability-commons admission request",
      description:
        "Validates reusable capability primitives, exact-version component observations, and architecture patterns against their source cases, releases, qualification references, metric results, and cross-object identities. Validation checks shape and reference integrity without upgrading maturity or evidence state.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsAdmissionRequest(request);
      return text({
        ok: validated.ok,
        errors: validated.errors,
        request: validated.value,
      });
    },
  );

  server.registerTool(
    "run_garpa_commons_admission",
    {
      title: "Run the GARPA capability-commons admission gate",
      description:
        "Admits reusable primitives, component observations, and architecture patterns only from the current verified release and only at the maturity and evidence state earned by exact fixtures, runs, metrics, execution classes, residuals, and falsification conditions. It supports partial admission while blocking any object that overstates scope or maturity.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsAdmissionRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = runCommonsAdmissionGate(validated.value);
      return text({
        ok: true,
        admissionBlocked: !result.passed,
        result,
        markdown: renderCommonsAdmissionMarkdown(validated.value, result),
      });
    },
  );
}
