import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type {
  AcceptedArtifactKind,
  ArtifactEnvelope,
  GarpaCaseIndex,
  GarpaCaseStage,
  GarpaCaseState,
  StageReceipt,
} from "../app/src/types/garpaCase.ts";

const CASE_DIRECTORIES = [
  "raw",
  "artifacts",
  "derived",
  "stages",
  "receipts/stage-receipts",
  "exports",
] as const;

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

function safeName(input: string): string {
  const name = basename(input)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  return name || "artifact.bin";
}

function kindForFilename(filename: string): AcceptedArtifactKind {
  const extension = extname(filename).toLowerCase();
  const mapping: Record<string, AcceptedArtifactKind> = {
    ".txt": "plain_text",
    ".md": "markdown",
    ".markdown": "markdown",
    ".html": "html",
    ".htm": "html",
    ".pdf": "pdf",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".webp": "image",
    ".gif": "image",
    ".mp3": "audio",
    ".wav": "audio",
    ".m4a": "audio",
    ".mp4": "video",
    ".mov": "video",
    ".mkv": "video",
    ".csv": "spreadsheet",
    ".xlsx": "spreadsheet",
    ".pptx": "presentation",
    ".zip": "archive",
    ".tar": "archive",
    ".gz": "archive",
  };
  return mapping[extension] ?? "other";
}

function mimeForKind(kind: AcceptedArtifactKind, filename: string): string | undefined {
  const extension = extname(filename).toLowerCase();
  const explicit: Record<string, string> = {
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".html": "text/html",
    ".htm": "text/html",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".csv": "text/csv",
    ".zip": "application/zip",
  };
  return explicit[extension] ?? (kind === "other" ? undefined : "application/octet-stream");
}

export async function sha256File(path: string): Promise<string> {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
}

export function casePath(root: string, caseId: string): string {
  const safeCaseId = caseId.replace(/[^A-Za-z0-9._-]/g, "_");
  if (!safeCaseId || safeCaseId === "." || safeCaseId === "..") {
    throw new Error("caseId does not produce a safe workspace directory.");
  }
  return join(root, safeCaseId);
}

export async function createCaseWorkspace(input: {
  root: string;
  caseId: string;
  title: string;
  now?: string;
}): Promise<{ caseDirectory: string; index: GarpaCaseIndex }> {
  if (!input.caseId.trim()) throw new Error("caseId is required.");
  if (!input.title.trim()) throw new Error("title is required.");
  const caseDirectory = casePath(input.root, input.caseId);
  await mkdir(caseDirectory, { recursive: true });
  for (const directory of CASE_DIRECTORIES) {
    await mkdir(join(caseDirectory, directory), { recursive: true });
  }
  const timestamp = nowIso(input.now);
  const index: GarpaCaseIndex = {
    schemaVersion: 1,
    caseId: input.caseId,
    title: input.title,
    createdAt: timestamp,
    updatedAt: timestamp,
    currentState: "created",
    currentStage: "intake",
    artifactIds: [],
    stageReceiptIds: [],
    latestDigests: {},
  };
  await writeCaseIndex(caseDirectory, index);
  return { caseDirectory, index };
}

export async function loadCaseIndex(caseDirectory: string): Promise<GarpaCaseIndex> {
  const raw = await readFile(join(caseDirectory, "case.json"), "utf8");
  return JSON.parse(raw) as GarpaCaseIndex;
}

export async function writeCaseIndex(
  caseDirectory: string,
  index: GarpaCaseIndex,
): Promise<void> {
  await writeFile(
    join(caseDirectory, "case.json"),
    `${JSON.stringify(index, null, 2)}\n`,
    "utf8",
  );
}

async function existingEnvelopeByDigest(
  caseDirectory: string,
  digest: string,
): Promise<ArtifactEnvelope | undefined> {
  const directory = join(caseDirectory, "artifacts");
  const filenames = await readdir(directory);
  for (const filename of filenames) {
    if (!filename.endsWith(".json")) continue;
    const raw = await readFile(join(directory, filename), "utf8");
    const envelope = JSON.parse(raw) as ArtifactEnvelope;
    if (envelope.sha256 === digest) return envelope;
  }
  return undefined;
}

export async function ingestArtifact(input: {
  caseDirectory: string;
  sourcePath: string;
  sourceUri?: string;
  declaredTitle?: string;
  kind?: AcceptedArtifactKind;
  now?: string;
}): Promise<{ envelope: ArtifactEnvelope; duplicate: boolean }> {
  const sourceInfo = await stat(input.sourcePath);
  if (!sourceInfo.isFile()) throw new Error("GARPA intake currently accepts files only.");
  const digest = await sha256File(input.sourcePath);
  const existing = await existingEnvelopeByDigest(input.caseDirectory, digest);
  if (existing) return { envelope: existing, duplicate: true };

  const originalFilename = basename(input.sourcePath);
  const storedFilename = `${digest.slice(0, 16)}-${safeName(originalFilename)}`;
  const kind = input.kind ?? kindForFilename(originalFilename);
  const artifactId = `artifact-${digest.slice(0, 20)}`;
  const envelope: ArtifactEnvelope = {
    schemaVersion: 1,
    artifactId,
    originalFilename,
    storedFilename,
    kind,
    mimeType: mimeForKind(kind, originalFilename),
    byteLength: sourceInfo.size,
    sha256: digest,
    sourceUri: input.sourceUri,
    capturedAt: nowIso(input.now),
    declaredTitle: input.declaredTitle,
    extractionState: "not_started",
    safetyState: "not_inspected",
    notes: [],
  };

  await copyFile(input.sourcePath, join(input.caseDirectory, "raw", storedFilename));
  await writeFile(
    join(input.caseDirectory, "artifacts", `${artifactId}.json`),
    `${JSON.stringify(envelope, null, 2)}\n`,
    "utf8",
  );

  const index = await loadCaseIndex(input.caseDirectory);
  index.artifactIds.push(artifactId);
  index.currentState = "intake_complete";
  index.currentStage = "intake";
  index.updatedAt = envelope.capturedAt;
  index.latestDigests.intake = digest;
  await writeCaseIndex(input.caseDirectory, index);

  return { envelope, duplicate: false };
}

export async function updateCaseState(input: {
  caseDirectory: string;
  state: GarpaCaseState;
  stage: GarpaCaseStage;
  digest?: string;
  now?: string;
}): Promise<GarpaCaseIndex> {
  const index = await loadCaseIndex(input.caseDirectory);
  index.currentState = input.state;
  index.currentStage = input.stage;
  index.updatedAt = nowIso(input.now);
  if (input.digest) index.latestDigests[input.stage] = input.digest;
  await writeCaseIndex(input.caseDirectory, index);
  return index;
}

export async function recordStageReceipt(input: {
  caseDirectory: string;
  stage: GarpaCaseStage;
  predecessorReceiptIds?: string[];
  inputDigests: string[];
  action: StageReceipt["action"];
  toolId: string;
  toolVersion: string;
  outputPaths: string[];
  outputDigests: string[];
  state: StageReceipt["state"];
  blockingReasons?: string[];
  nextActions?: string[];
  startedAt: string;
  completedAt: string;
  receiptId?: string;
}): Promise<StageReceipt> {
  const index = await loadCaseIndex(input.caseDirectory);
  const receipt: StageReceipt = {
    schemaVersion: 1,
    receiptId: input.receiptId ?? `receipt-${randomUUID()}`,
    caseId: index.caseId,
    stage: input.stage,
    predecessorReceiptIds: input.predecessorReceiptIds ?? [],
    inputDigests: input.inputDigests,
    action: input.action,
    toolId: input.toolId,
    toolVersion: input.toolVersion,
    outputPaths: input.outputPaths,
    outputDigests: input.outputDigests,
    state: input.state,
    blockingReasons: input.blockingReasons ?? [],
    nextActions: input.nextActions ?? [],
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  };
  const receiptPath = join(
    input.caseDirectory,
    "receipts",
    "stage-receipts",
    `${receipt.receiptId}.json`,
  );
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  index.stageReceiptIds.push(receipt.receiptId);
  index.updatedAt = input.completedAt;
  if (receipt.state === "admitted" && receipt.outputDigests.length > 0) {
    const digest = receipt.outputDigests.at(-1);
    if (digest) index.latestDigests[receipt.stage] = digest;
  }
  await writeCaseIndex(input.caseDirectory, index);
  return receipt;
}
