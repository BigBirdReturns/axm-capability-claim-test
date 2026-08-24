import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderCommonsSeededReleaseMarkdown } from "../app/src/lib/garpa/renderCommonsSeededRelease.ts";
import { runCommonsSeededReleaseGate } from "../app/src/lib/garpa/runCommonsSeededReleaseGate.ts";
import { validateCommonsSeededReleaseRequest } from "../app/src/lib/garpa/validateCommonsSeededRelease.ts";

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

export function registerGarpaCommonsSeededReleaseTools(
  server: McpServer,
): void {
  server.registerTool(
    "validate_garpa_commons_seeded_release",
    {
      title: "Validate a GARPA Commons-seeded release request",
      description:
        "Validates the publication-ready predecessor, exact current R1 manifest, UTF-8 file payloads, hashes, byte lengths, release envelope, chronology, and false equivalence, deployment, registry, and public-release assertions. Validation does not establish bundle integrity.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const result = validateCommonsSeededReleaseRequest(request);
      return text({ ok: result.ok, errors: result.errors });
    },
  );

  server.registerTool(
    "run_garpa_commons_seeded_release",
    {
      title: "Run the GARPA Commons-seeded release-verification gate",
      description:
        "Recomputes publication custody, generates every mandatory release file, verifies exact content, hashes, byte lengths, paths, manifest, and envelope, and delegates to both existing release verifiers. Admission establishes candidate-bundle integrity only. It does not mean public release, registry update, deployment authority, or unrestricted equivalence.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateCommonsSeededReleaseRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = runCommonsSeededReleaseGate(validated.value);
      return text({
        ok: true,
        releaseBlocked: result.state === "seeded_release_blocked",
        releaseRecordAdmitted: result.passed,
        releaseVerified: result.releaseVerified,
        releaseState: result.releaseState,
        result,
        markdown: renderCommonsSeededReleaseMarkdown(
          validated.value,
          result,
        ),
      });
    },
  );
}
