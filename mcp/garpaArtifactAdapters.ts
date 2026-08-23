import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ArtifactEnvelope,
  ArtifactExtraction,
  ExtractedBlock,
} from "../app/src/types/garpaCase.ts";
import {
  loadCaseIndex,
  recordStageReceipt,
  updateCaseState,
} from "./garpaCaseWorkspace.ts";

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function decodeEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": "\"",
    "&#39;": "'",
    "&nbsp;": " ",
  };
  return text.replace(
    /&(amp|lt|gt|quot|#39|nbsp);/g,
    (match) => entities[match] ?? match,
  );
}

function passiveHtmlToText(html: string): {
  text: string;
  activeContentRemoved: boolean;
} {
  const activePattern = /<(script|style|noscript|iframe|object|embed|form)\b[\s\S]*?<\/\1\s*>/gi;
  const activeContentRemoved = activePattern.test(html) || /\son\w+\s*=|javascript:/i.test(html);
  const withoutActive = html
    .replace(activePattern, "\n")
    .replace(/<!--([\s\S]*?)-->/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return {
    text: decodeEntities(withoutActive)
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    activeContentRemoved,
  };
}

function paragraphBlocks(text: string): ExtractedBlock[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ExtractedBlock[] = [];
  let buffer: string[] = [];
  let startLine = 1;

  function flush(endLine: number): void {
    const value = buffer.join("\n").trim();
    if (value) {
      blocks.push({
        id: `block-${blocks.length + 1}`,
        text: value,
        startLine,
        endLine,
        extractionMethod: "native_text",
        confidence: 1,
      });
    }
    buffer = [];
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (!line.trim()) {
      if (buffer.length > 0) flush(lineNumber - 1);
      startLine = lineNumber + 1;
      return;
    }
    if (buffer.length === 0) startLine = lineNumber;
    buffer.push(line);
  });
  if (buffer.length > 0) flush(lines.length);
  return blocks;
}

export async function loadArtifactEnvelope(
  caseDirectory: string,
  artifactId: string,
): Promise<ArtifactEnvelope> {
  const raw = await readFile(
    join(caseDirectory, "artifacts", `${artifactId}.json`),
    "utf8",
  );
  return JSON.parse(raw) as ArtifactEnvelope;
}

async function saveArtifactEnvelope(
  caseDirectory: string,
  envelope: ArtifactEnvelope,
): Promise<void> {
  await writeFile(
    join(caseDirectory, "artifacts", `${envelope.artifactId}.json`),
    `${JSON.stringify(envelope, null, 2)}\n`,
    "utf8",
  );
}

export async function extractArtifact(input: {
  caseDirectory: string;
  artifactId: string;
  now?: string;
}): Promise<ArtifactExtraction> {
  const startedAt = input.now ?? new Date().toISOString();
  const envelope = await loadArtifactEnvelope(
    input.caseDirectory,
    input.artifactId,
  );
  const sourcePath = join(
    input.caseDirectory,
    "raw",
    envelope.storedFilename,
  );
  const warnings: string[] = [];
  const failures: string[] = [];
  let textBlocks: ExtractedBlock[] = [];
  let adapterId = "unsupported-passive-adapter";
  let safetyState: ArtifactEnvelope["safetyState"] = "not_inspected";
  let extractionState: ArtifactEnvelope["extractionState"] = "unsupported";

  if (
    envelope.kind === "plain_text" ||
    envelope.kind === "markdown" ||
    envelope.kind === "transcript"
  ) {
    adapterId = "native-text-v1";
    const text = await readFile(sourcePath, "utf8");
    textBlocks = paragraphBlocks(text);
    safetyState = "passive_content";
    extractionState = "complete";
  } else if (envelope.kind === "html" || envelope.kind === "web_snapshot") {
    adapterId = "passive-html-v1";
    const html = await readFile(sourcePath, "utf8");
    const result = passiveHtmlToText(html);
    textBlocks = paragraphBlocks(result.text);
    safetyState = result.activeContentRemoved
      ? "active_content_removed"
      : "passive_content";
    extractionState = "complete";
    if (result.activeContentRemoved) {
      warnings.push("Active HTML content and event-bearing markup were removed before extraction.");
    }
  } else {
    warnings.push(
      `No passive extractor is implemented for artifact kind ${envelope.kind}. Original bytes remain preserved.`,
    );
  }

  if (extractionState === "complete" && textBlocks.length === 0) {
    extractionState = "partial";
    warnings.push("The adapter completed but produced no non-empty text blocks.");
  }

  const provisional = {
    schemaVersion: 1 as const,
    artifactId: envelope.artifactId,
    adapterId,
    adapterVersion: "1.0.0",
    textBlocks,
    metadata: {
      originalFilename: envelope.originalFilename ?? "",
      kind: envelope.kind,
      mimeType: envelope.mimeType ?? "",
    },
    warnings,
    failures,
  };
  const extractionDigest = sha256Text(JSON.stringify(provisional));
  const extraction: ArtifactExtraction = {
    ...provisional,
    extractionDigest,
  };
  const outputPath = join(
    input.caseDirectory,
    "derived",
    `${envelope.artifactId}-extraction.json`,
  );
  await writeFile(outputPath, `${JSON.stringify(extraction, null, 2)}\n`, "utf8");

  envelope.extractionState = extractionState;
  envelope.safetyState = safetyState;
  envelope.notes = [...envelope.notes, ...warnings];
  await saveArtifactEnvelope(input.caseDirectory, envelope);

  const completedAt = input.now ?? new Date().toISOString();
  await recordStageReceipt({
    caseDirectory: input.caseDirectory,
    stage: "extraction",
    inputDigests: [envelope.sha256],
    action: "extract",
    toolId: adapterId,
    toolVersion: "1.0.0",
    outputPaths: [outputPath],
    outputDigests: [extractionDigest],
    state: extractionState === "unsupported" ? "review_required" : "admitted",
    blockingReasons:
      extractionState === "unsupported"
        ? [`No extractor implemented for ${envelope.kind}.`]
        : [],
    nextActions:
      extractionState === "unsupported"
        ? ["Supply a transcript, native export, or compatible adapter."]
        : ["Generate a source-addressable claim packet from the extraction."],
    startedAt,
    completedAt,
  });

  const index = await loadCaseIndex(input.caseDirectory);
  const allComplete = await Promise.all(
    index.artifactIds.map(async (artifactId) => {
      const current = await loadArtifactEnvelope(input.caseDirectory, artifactId);
      return current.extractionState === "complete" || current.extractionState === "partial";
    }),
  );
  await updateCaseState({
    caseDirectory: input.caseDirectory,
    state: allComplete.every(Boolean) ? "extraction_complete" : "intake_complete",
    stage: "extraction",
    digest: extractionDigest,
    now: completedAt,
  });

  return extraction;
}
