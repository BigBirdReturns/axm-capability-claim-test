import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createCaseWorkspace,
  ingestArtifact,
  loadCaseIndex,
} from "./garpaCaseWorkspace.ts";
import {
  extractArtifact,
  loadArtifactEnvelope,
} from "./garpaArtifactAdapters.ts";

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

export function registerGarpaCaseTools(server: McpServer): void {
  server.registerTool(
    "create_garpa_case",
    {
      title: "Create a GARPA case workspace",
      description:
        "Creates the content-addressed case directory, raw/artifact/derived/stage/receipt/export structure, and authoritative case index.",
      inputSchema: {
        root: z.string().min(1),
        caseId: z.string().min(1),
        title: z.string().min(1),
      },
    },
    async ({ root, caseId, title }) => {
      const result = await createCaseWorkspace({ root, caseId, title });
      return text(JSON.stringify({ ok: true, ...result }, null, 2));
    },
  );

  server.registerTool(
    "ingest_garpa_artifact",
    {
      title: "Ingest a local artifact into a GARPA case",
      description:
        "Hashes and copies a local file into the immutable raw store, writes its artifact envelope, deduplicates identical bytes, and advances intake only.",
      inputSchema: {
        caseDirectory: z.string().min(1),
        sourcePath: z.string().min(1),
        sourceUri: z.string().optional(),
        declaredTitle: z.string().optional(),
      },
    },
    async ({ caseDirectory, sourcePath, sourceUri, declaredTitle }) => {
      const result = await ingestArtifact({
        caseDirectory,
        sourcePath,
        sourceUri,
        declaredTitle,
      });
      return text(JSON.stringify({ ok: true, ...result }, null, 2));
    },
  );

  server.registerTool(
    "extract_garpa_artifact",
    {
      title: "Passively extract a GARPA artifact",
      description:
        "Runs the bounded passive adapter for text, Markdown, transcripts, or HTML; removes active HTML; preserves unsupported bytes; writes an extraction and stage receipt.",
      inputSchema: {
        caseDirectory: z.string().min(1),
        artifactId: z.string().min(1),
      },
    },
    async ({ caseDirectory, artifactId }) => {
      const extraction = await extractArtifact({ caseDirectory, artifactId });
      return text(
        JSON.stringify(
          {
            ok: true,
            extractionBlocked:
              extraction.failures.length > 0 || extraction.textBlocks.length === 0,
            extraction,
          },
          null,
          2,
        ),
      );
    },
  );

  server.registerTool(
    "extract_all_garpa_artifacts",
    {
      title: "Extract all pending GARPA artifacts",
      description:
        "Runs passive extraction for every not-started or unsupported case artifact and returns the resulting authoritative case state.",
      inputSchema: {
        caseDirectory: z.string().min(1),
      },
    },
    async ({ caseDirectory }) => {
      const index = await loadCaseIndex(caseDirectory);
      const results = [];
      for (const artifactId of index.artifactIds) {
        const envelope = await loadArtifactEnvelope(caseDirectory, artifactId);
        if (
          envelope.extractionState === "complete" ||
          envelope.extractionState === "partial"
        ) {
          results.push({
            artifactId,
            skipped: true,
            extractionState: envelope.extractionState,
          });
          continue;
        }
        const extraction = await extractArtifact({ caseDirectory, artifactId });
        results.push({ artifactId, skipped: false, extraction });
      }
      const current = await loadCaseIndex(caseDirectory);
      return text(
        JSON.stringify(
          {
            ok: true,
            extractionBlocked: current.currentState !== "extraction_complete",
            case: current,
            results,
          },
          null,
          2,
        ),
      );
    },
  );

  server.registerTool(
    "get_garpa_case_status",
    {
      title: "Get GARPA case status",
      description:
        "Returns the authoritative case state, stage, artifact identities, stage receipts, and latest admitted digests.",
      inputSchema: {
        caseDirectory: z.string().min(1),
      },
    },
    async ({ caseDirectory }) =>
      text(
        JSON.stringify(
          { ok: true, case: await loadCaseIndex(caseDirectory) },
          null,
          2,
        ),
      ),
  );
}
