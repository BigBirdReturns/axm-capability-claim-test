import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validatePublicationPackage } from "../app/src/lib/garpa/validatePublicationPackage.ts";
import { runPublicationGate } from "../app/src/lib/garpa/runPublicationGate.ts";

const JSON_INPUT = z.union([z.string(), z.record(z.any())]);

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

export function registerGarpaPublicationTools(server: McpServer): void {
  server.registerTool(
    "validate_garpa_publication_package",
    {
      title: "Validate a GARPA publication package",
      description:
        "Validates typed public claims, support edges, audience, rights, safety, and redaction references before publication review.",
      inputSchema: {
        publicationPackage: JSON_INPUT.describe(
          "Publication package object or JSON string.",
        ),
      },
    },
    async ({ publicationPackage }) => {
      const result = validatePublicationPackage(publicationPackage);
      return text(
        JSON.stringify(
          {
            ok: result.ok,
            errors: result.errors,
            publicationPackage: result.value,
          },
          null,
          2,
        ),
      );
    },
  );

  server.registerTool(
    "run_garpa_publication_gate",
    {
      title: "Run the GARPA publication gate",
      description:
        "Refuses unsupported, over-scoped, stale, rights-blocked, safety-blocked, redaction-invalidated, cost-misaligned, or unsupported vendor-parity claims.",
      inputSchema: {
        publicationPackage: JSON_INPUT.describe(
          "Publication package object or JSON string.",
        ),
        expectedUpstreamDigests: z.record(z.string()),
      },
    },
    async ({ publicationPackage, expectedUpstreamDigests }) => {
      const validation = validatePublicationPackage(publicationPackage);
      if (!validation.ok || !validation.value) {
        return text(
          JSON.stringify(
            {
              ok: false,
              stage: "publication_package",
              errors: validation.errors,
            },
            null,
            2,
          ),
        );
      }
      const gate = runPublicationGate(
        validation.value,
        expectedUpstreamDigests,
      );
      return text(
        JSON.stringify(
          {
            ok: true,
            publicationBlocked: !gate.passed,
            gate,
          },
          null,
          2,
        ),
      );
    },
  );
}
