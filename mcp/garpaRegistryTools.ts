import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  validatePublicCaseRegistryEntry,
  validateRegistryReleaseUpdateRequest,
} from "../app/src/lib/garpa/validateCaseRegistry.ts";
import { applyRegistryReleaseUpdate } from "../app/src/lib/garpa/runRegistryUpdateGate.ts";
import { renderRegistryUpdateMarkdown } from "../app/src/lib/garpa/renderRegistryUpdate.ts";

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

export function registerGarpaRegistryTools(server: McpServer): void {
  server.registerTool(
    "validate_garpa_case_registry",
    {
      title: "Validate a GARPA public case registry object",
      description:
        "Validates either a public case-registry entry or a release-update request. It enforces one current release, one current offering version, contiguous release numbers, matching current pointers, unique release identities and digests, and source-addressable identity lineage shapes.",
      inputSchema: {
        kind: z.enum(["entry", "release_update"]),
        payload: JSON_INPUT,
      },
    },
    async ({ kind, payload }) => {
      const validated =
        kind === "entry"
          ? validatePublicCaseRegistryEntry(payload)
          : validateRegistryReleaseUpdateRequest(payload);
      return text({ ok: validated.ok, errors: validated.errors });
    },
  );

  server.registerTool(
    "apply_garpa_registry_release",
    {
      title: "Apply a GARPA governing-release update",
      description:
        "Runs the registry update gate and, only when it passes, returns the candidate next registry entry. It blocks stale current pointers, release-number gaps, incorrect prior-release lineage, reused release identities, unverified releases, withdrawn cases, and rebrands without source-backed identity lineage. Prior releases are preserved and the previous current release becomes superseded.",
      inputSchema: { request: JSON_INPUT },
    },
    async ({ request }) => {
      const validated = validateRegistryReleaseUpdateRequest(request);
      if (!validated.ok || !validated.value) {
        return text({ ok: false, errors: validated.errors });
      }
      const result = applyRegistryReleaseUpdate(validated.value);
      return text({
        ok: true,
        updateBlocked: !result.gate.passed,
        result,
        markdown: renderRegistryUpdateMarkdown(result),
      });
    },
  );
}
