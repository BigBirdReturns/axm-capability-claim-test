import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type {
  GarpaReleaseManifest,
  ReleaseFileRecord,
  ReleaseVerificationRequest,
} from "../../types/garpaRelease";

const SHA256 = /^[a-f0-9]{64}$/i;

const FileRecordSchema = z
  .object({
    path: z.string().min(1),
    sha256: z.string().regex(SHA256, "sha256 must be 64 hexadecimal characters."),
    byteLength: z.number().int().nonnegative(),
    mediaType: z.string().optional(),
    role: z.enum([
      "release_metadata",
      "manifest",
      "reality_brief",
      "public_dossier",
      "publication_claims",
      "support_graph",
      "source_ledger",
      "engineering_summary",
      "mission_evaluation",
      "vendor_parity",
      "metric_results",
      "cost_ledger",
      "failure_register",
      "residual_register",
      "gate_receipt",
      "rights_receipt",
      "safety_receipt",
      "redaction_receipt",
      "asset",
      "other",
    ]),
  })
  .strict();

const ManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    releaseId: z.string().min(1),
    caseId: z.string().min(1),
    releaseNumber: z.number().int().positive(),
    publicationPackageDigest: z.string().regex(SHA256),
    publicationGateReceiptDigest: z.string().regex(SHA256),
    priorReleaseDigest: z.string().regex(SHA256).optional(),
    supersedesReleaseId: z.string().optional(),
    createdAt: z.string().min(1),
    state: z.enum(["current", "superseded", "withdrawn"]),
    files: z.array(FileRecordSchema),
    manifestDigest: z.string().regex(SHA256),
  })
  .strict();

const RegistrySchema = z
  .object({
    caseId: z.string().min(1),
    currentReleaseId: z.string().optional(),
    currentReleaseDigest: z.string().regex(SHA256).optional(),
    supersededReleaseIds: z.array(z.string().min(1)),
    withdrawnReleaseIds: z.array(z.string().min(1)),
  })
  .strict();

const VerificationRequestSchema = z
  .object({
    manifest: ManifestSchema,
    computedManifestDigest: z.string().regex(SHA256),
    observedFiles: z.array(FileRecordSchema),
    registry: RegistrySchema.optional(),
  })
  .strict();

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export function isSafeReleasePath(path: string): boolean {
  if (!path || path.startsWith("/") || path.startsWith("\\")) return false;
  if (/^[A-Za-z]:/.test(path) || path.includes("\\")) return false;
  const segments = path.split("/");
  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== "..",
  );
}

function duplicatePaths(files: ReleaseFileRecord[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const file of files) {
    if (seen.has(file.path)) repeated.add(file.path);
    seen.add(file.path);
  }
  return [...repeated];
}

export function validateReleaseManifest(
  input: unknown,
): GarpaValidationResult<GarpaReleaseManifest> {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input) as unknown;
    } catch (error) {
      return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
    }
  }

  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const manifest = parsed.data;
  const errors: string[] = [];
  for (const path of duplicatePaths(manifest.files)) {
    errors.push(`files contains duplicate path "${path}".`);
  }
  for (const file of manifest.files) {
    if (!isSafeReleasePath(file.path)) {
      errors.push(`files contains unsafe path "${file.path}".`);
    }
  }
  if (manifest.releaseNumber > 1 && !manifest.priorReleaseDigest) {
    errors.push("A release after R1 requires priorReleaseDigest.");
  }
  if (manifest.supersedesReleaseId && manifest.releaseNumber === 1) {
    errors.push("Release R1 cannot supersede an earlier release identifier.");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: manifest as GarpaReleaseManifest };
}

export function validateReleaseVerificationRequest(
  input: unknown,
): GarpaValidationResult<ReleaseVerificationRequest> {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input) as unknown;
    } catch (error) {
      return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
    }
  }

  const parsed = VerificationRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const manifest = validateReleaseManifest(parsed.data.manifest);
  const errors = [...manifest.errors];
  for (const path of duplicatePaths(parsed.data.observedFiles)) {
    errors.push(`observedFiles contains duplicate path "${path}".`);
  }
  for (const file of parsed.data.observedFiles) {
    if (!isSafeReleasePath(file.path)) {
      errors.push(`observedFiles contains unsafe path "${file.path}".`);
    }
  }
  if (errors.length > 0 || !manifest.value) return { ok: false, errors };

  return {
    ok: true,
    errors: [],
    value: {
      ...parsed.data,
      manifest: manifest.value,
    } as ReleaseVerificationRequest,
  };
}
