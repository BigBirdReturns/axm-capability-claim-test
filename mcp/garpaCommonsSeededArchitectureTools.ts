import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateCommonsSeededArchitectureRequest } from "../app/src/lib/garpa/validateCommonsSeededArchitecture.ts";
import { runCommonsSeededArchitectureGate } from "../app/src/lib/garpa/runCommonsSeededArchitectureGate.ts";
import { renderCommonsSeededArchitectureMarkdown } from "../app/src/lib/garpa/renderCommonsSeededArchitecture.ts";

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

export function registerGarpaCommonsSeededArchitectureTools(
  server: McpServer,
): void {
  server.registerTool(
    "validate_garpa_commons_seeded_architecture",
    {
      title: "Validate a GARPA Commons-seeded architecture request",
      description:
        "Validates the seeded-substitution request, exact result-digest envelope, target CandidateArchitecture, component, option, interface, role, dependency, evidence, schedule, risk, and residual references. Validation does not admit the architecture.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const result = validateCommonsSeededArchitectureRequest(request);
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "run_garpa_commons_seeded_architecture",
    {
      title: "Run a GARPA Commons-seeded candidate architecture",
      description:
        "Recomputes seeded substitution, verifies its result digest and the canonical substitution-plan digest, preserves exact seeded component selection and version configuration, and delegates option, compatibility, human-role, dependency, cost, schedule, risk, residual, and state admission to the existing architecture gate. It never authorizes procurement, building, testing, deployment, or equivalence.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsSeededArchitectureRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = runCommonsSeededArchitectureGate(validated.value);
      return text({
        ok: true,
        architectureBlocked: result.state === "seeded_architecture_blocked",
        admittedForQualification: result.passed,
        result,
        markdown: renderCommonsSeededArchitectureMarkdown(
          validated.value,
          result,
        ),
      });
    },
  );
}
