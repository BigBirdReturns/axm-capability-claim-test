import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validatePublicationPackage } from "../app/src/lib/garpa/validatePublicationPackage.ts";
import { runPublicationGate } from "../app/src/lib/garpa/runPublicationGate.ts";
import {
  validateReleaseManifestShape,
  verifyReleaseManifest,
} from "../app/src/lib/garpa/verifyReleaseManifest.ts";
import type { GarpaReleaseManifest } from "../app/src/types/garpaRelease.ts";

const JSON_INPUT = z.union([z.string(), z.record(z.any())]);

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

function parseManifest(input: unknown): GarpaReleaseManifest | undefined {
  if (typeof input === "string") {
    try {
      return JSON.parse(input) as GarpaReleaseManifest;
    } catch {
      return undefined;
    }
  }
  return input as GarpaReleaseManifest;
}

export function registerGarpaReleaseTools(server: McpServer): void {
  server.registerTool(
    "verify_garpa_release",
    {
      title: "Verify a GARPA release",
      description:
        "Verifies required release paths, SHA-256 digests, byte lengths, absence of unmanifested files, safe paths, and a passing publication gate.",
      inputSchema: {
        releaseManifest: JSON_INPUT,
        actualFiles: z.record(
          z.object({
            sha256: z.string(),
            byteLength: z.number().int().nonnegative(),
          }),
        ),
        publicationPackage: JSON_INPUT,
        expectedUpstreamDigests: z.record(z.string()),
      },
    },
    async ({
      releaseManifest,
      actualFiles,
      publicationPackage,
      expectedUpstreamDigests,
    }) => {
      const manifest = parseManifest(releaseManifest);
      if (!manifest) {
        return text(
          JSON.stringify(
            { ok: false, stage: "release_manifest", errors: ["Invalid JSON."] },
            null,
            2,
          ),
        );
      }
      const shapeErrors = validateReleaseManifestShape(manifest);
      if (shapeErrors.length > 0) {
        return text(
          JSON.stringify(
            { ok: false, stage: "release_manifest", errors: shapeErrors },
            null,
            2,
          ),
        );
      }
      const publication = validatePublicationPackage(publicationPackage);
      if (!publication.ok || !publication.value) {
        return text(
          JSON.stringify(
            {
              ok: false,
              stage: "publication_package",
              errors: publication.errors,
            },
            null,
            2,
          ),
        );
      }
      const publicationGate = runPublicationGate(
        publication.value,
        expectedUpstreamDigests,
      );
      const verification = verifyReleaseManifest({
        manifest,
        actualFiles,
        publicationGate,
      });
      return text(
        JSON.stringify(
          {
            ok: true,
            releaseBlocked: !verification.passed,
            publicationGate,
            verification,
          },
          null,
          2,
        ),
      );
    },
  );
}
