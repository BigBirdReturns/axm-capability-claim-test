import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type {
  CommonsSeededReleaseEnvelope,
  CommonsSeededReleaseFilePayload,
  CommonsSeededReleaseRequest,
} from "../../types/garpaCommonsSeededRelease";
import type { GarpaReleaseManifest } from "../../types/garpaRelease";
import { isSafeReleasePath } from "./validateReleaseManifest";
import { validateCommonsSeededPublicationRequest } from "./validateCommonsSeededPublication";

const SHA256 = /^[a-f0-9]{64}$/i;
const ROLES = [
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
] as const;

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function validDate(value: unknown): value is string {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}

const FileRecordSchema = z
  .object({
    path: z.string().min(1),
    sha256: z.string().regex(SHA256),
    byteLength: z.number().int().nonnegative(),
    mediaType: z.string().min(1),
    role: z.enum(ROLES),
    required: z.literal(true),
  })
  .strict();

const FilePayloadSchema = FileRecordSchema.extend({
  contentEncoding: z.literal("utf-8"),
  content: z.string(),
}).strict();

const ManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    releaseId: z.string().min(1),
    caseId: z.string().min(1),
    releaseNumber: z.literal(1),
    publicationPackageDigest: z.string().regex(SHA256),
    publicationGateReceiptDigest: z.string().regex(SHA256),
    priorReleaseDigest: z.never().optional(),
    supersedesReleaseId: z.never().optional(),
    files: z.array(FileRecordSchema),
    manifestDigest: z.string().regex(SHA256),
    createdAt: z.string().refine((value) => validDate(value), "Invalid date-time."),
    state: z.literal("current"),
  })
  .strict();

const EnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    releaseReceiptId: z.string().min(1),
    caseId: z.string().min(1),
    releaseId: z.string().min(1),
    releaseNumber: z.literal(1),
    releaseState: z.literal("current"),
    caseIndexDigest: z.string().regex(SHA256),
    seededPublicationResultDigest: z.string().regex(SHA256),
    publicationPackageDigest: z.string().regex(SHA256),
    publicationGateResultDigest: z.string().regex(SHA256),
    releaseManifestDigest: z.string().regex(SHA256),
    fileSetDigest: z.string().regex(SHA256),
    bundleDigest: z.string().regex(SHA256),
    verifiedAt: z.string().refine((value) => validDate(value), "Invalid date-time."),
    publicationReady: z.literal(true),
    unrestrictedEquivalenceClaimed: z.literal(false),
    deploymentAuthorityClaimed: z.literal(false),
    registryUpdated: z.literal(false),
    publicReleaseOccurred: z.literal(false),
    envelopeDigest: z.string().regex(SHA256),
  })
  .strict();

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

export function validateCommonsSeededReleaseRequest(
  input: unknown,
): GarpaValidationResult<CommonsSeededReleaseRequest> {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch (error) {
      return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["Commons-seeded release request must be an object."] };
  }
  const record = value as Record<string, unknown>;
  const errors: string[] = [];
  if (record.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (
    !nonEmpty(record.expectedSeededPublicationResultDigest) ||
    !SHA256.test(record.expectedSeededPublicationResultDigest)
  ) {
    errors.push("expectedSeededPublicationResultDigest must be a SHA-256 hex digest.");
  }
  if (!validDate(record.admittedAt)) errors.push("admittedAt must be a valid date-time.");

  const publication = validateCommonsSeededPublicationRequest(
    record.seededPublicationRequest,
  );
  errors.push(
    ...publication.errors.map((error) => `seededPublicationRequest: ${error}`),
  );
  const manifest = ManifestSchema.safeParse(record.releaseManifest);
  if (!manifest.success) errors.push(...formatIssues(manifest.error));
  const files = z.array(FilePayloadSchema).safeParse(record.releaseFiles);
  if (!files.success) errors.push(...formatIssues(files.error));
  const envelope = EnvelopeSchema.safeParse(record.releaseEnvelope);
  if (!envelope.success) errors.push(...formatIssues(envelope.error));

  if (files.success) {
    const paths = files.data.map((file) => file.path);
    for (const path of duplicates(paths)) {
      errors.push(`releaseFiles contains duplicate path "${path}".`);
    }
    for (const path of paths) {
      if (!isSafeReleasePath(path)) {
        errors.push(`releaseFiles contains unsafe path "${path}".`);
      }
    }
  }
  if (manifest.success) {
    const paths = manifest.data.files.map((file) => file.path);
    for (const path of duplicates(paths)) {
      errors.push(`releaseManifest.files contains duplicate path "${path}".`);
    }
    for (const path of paths) {
      if (!isSafeReleasePath(path)) {
        errors.push(`releaseManifest.files contains unsafe path "${path}".`);
      }
    }
  }

  if (
    errors.length > 0 ||
    !publication.value ||
    !manifest.success ||
    !files.success ||
    !envelope.success
  ) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }
  return {
    ok: true,
    errors: [],
    value: {
      schemaVersion: 1,
      seededPublicationRequest: publication.value,
      expectedSeededPublicationResultDigest:
        record.expectedSeededPublicationResultDigest as string,
      releaseManifest: manifest.data as GarpaReleaseManifest,
      releaseFiles: files.data as CommonsSeededReleaseFilePayload[],
      releaseEnvelope: envelope.data as CommonsSeededReleaseEnvelope,
      admittedAt: record.admittedAt as string,
    },
  };
}
