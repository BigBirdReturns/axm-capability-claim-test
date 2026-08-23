#!/usr/bin/env -S npx tsx
import {
  createCaseWorkspace,
  ingestArtifact,
  loadCaseIndex,
} from "./garpaCaseWorkspace.ts";
import {
  extractArtifact,
  loadArtifactEnvelope,
} from "./garpaArtifactAdapters.ts";

function usage(): never {
  process.stderr.write(
    [
      "Usage:",
      "  garpaCaseCli.ts init ROOT CASE_ID TITLE",
      "  garpaCaseCli.ts add CASE_DIRECTORY FILE",
      "  garpaCaseCli.ts extract CASE_DIRECTORY ARTIFACT_ID",
      "  garpaCaseCli.ts extract-all CASE_DIRECTORY",
      "  garpaCaseCli.ts status CASE_DIRECTORY",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

function write(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function init(args: string[]): Promise<void> {
  const [root, caseId, ...titleParts] = args;
  const title = titleParts.join(" ").trim();
  if (!root || !caseId || !title) usage();
  const result = await createCaseWorkspace({ root, caseId, title });
  write({ ok: true, ...result });
}

async function add(args: string[]): Promise<void> {
  const [caseDirectory, sourcePath] = args;
  if (!caseDirectory || !sourcePath || args.length !== 2) usage();
  const result = await ingestArtifact({ caseDirectory, sourcePath });
  write({ ok: true, ...result });
}

async function extract(args: string[]): Promise<void> {
  const [caseDirectory, artifactId] = args;
  if (!caseDirectory || !artifactId || args.length !== 2) usage();
  const result = await extractArtifact({ caseDirectory, artifactId });
  write({
    ok: true,
    extractionBlocked: result.failures.length > 0 || result.textBlocks.length === 0,
    extraction: result,
  });
  if (result.textBlocks.length === 0) process.exitCode = 2;
}

async function extractAll(args: string[]): Promise<void> {
  const [caseDirectory] = args;
  if (!caseDirectory || args.length !== 1) usage();
  const index = await loadCaseIndex(caseDirectory);
  const results = [];
  for (const artifactId of index.artifactIds) {
    const envelope = await loadArtifactEnvelope(caseDirectory, artifactId);
    if (
      envelope.extractionState === "complete" ||
      envelope.extractionState === "partial"
    ) {
      results.push({ artifactId, skipped: true, extractionState: envelope.extractionState });
      continue;
    }
    const extraction = await extractArtifact({ caseDirectory, artifactId });
    results.push({ artifactId, skipped: false, extraction });
  }
  const current = await loadCaseIndex(caseDirectory);
  write({
    ok: true,
    extractionBlocked: current.currentState !== "extraction_complete",
    case: current,
    results,
  });
  if (current.currentState !== "extraction_complete") process.exitCode = 2;
}

async function status(args: string[]): Promise<void> {
  const [caseDirectory] = args;
  if (!caseDirectory || args.length !== 1) usage();
  write({ ok: true, case: await loadCaseIndex(caseDirectory) });
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command === "init") return init(args);
  if (command === "add") return add(args);
  if (command === "extract") return extract(args);
  if (command === "extract-all") return extractAll(args);
  if (command === "status") return status(args);
  usage();
}

await main();
