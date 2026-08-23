import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderCommonsSeededBuildManifestMarkdown } from "../app/src/lib/garpa/renderCommonsSeededBuildManifest.ts";
import { runCommonsSeededBuildManifestGate } from "../app/src/lib/garpa/runCommonsSeededBuildManifestGate.ts";
import { validateCommonsSeededBuildManifestRequest } from "../app/src/lib/garpa/validateCommonsSeededBuildManifest.ts";

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

export function registerGarpaCommonsSeededBuildManifestTools(
  server: McpServer,
): void {
  server.registerTool(
    "validate_garpa_commons_seeded_build_manifest",
    {
      title: "Validate a GARPA Commons-seeded build manifest",
      description:
        "Validates the complete seeded qualification request, exact target build manifest, canonical digests, one build-custody binding per Commons-seeded component, calibration or preassembly verification references, and assembly-step references. Validation does not admit controlled assembly.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const result = validateCommonsSeededBuildManifestRequest(request);
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "run_garpa_commons_seeded_build_manifest",
    {
      title: "Run a GARPA Commons-seeded build-manifest gate",
      description:
        "Recomputes seeded qualification, verifies its result digest, binds the exact Commons source, qualified architecture selection and configuration, target manifest component, no-substitution policy, target qualification regressions, calibration or verification items, and assembly steps, then delegates substantive admission to the existing build-manifest gate. Passing authorizes controlled assembly only and does not create an as-built receipt, execution authority, test result, deployment claim, parity claim, or publication claim.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsSeededBuildManifestRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = runCommonsSeededBuildManifestGate(validated.value);
      return text({
        ok: true,
        buildManifestBlocked:
          result.state === "seeded_build_manifest_blocked",
        admittedForControlledAssembly: result.passed,
        result,
        markdown: renderCommonsSeededBuildManifestMarkdown(
          validated.value,
          result,
        ),
      });
    },
  );
}
