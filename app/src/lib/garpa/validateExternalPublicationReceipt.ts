import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type {
  ExternalPublicationReceiptRequest,
} from "../../types/garpaExternalPublication";

const SHA256 = /^[a-f0-9]{64}$/i;

function validDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

const ArtifactSchema = z
  .object({
    artifactId: z.string().min(1),
    sha256: z.string().regex(SHA256),
    byteLength: z.number().int().nonnegative(),
    mediaType: z.string().min(1),
    capturePath: z.string().min(1),
    sourceLocator: z.string().min(1),
    contentEncoding: z.literal("utf-8"),
    content: z.string(),
    capturedAt: z.string().refine(validDate, "Invalid date-time."),
  })
  .strict();

const ReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    receiptId: z.string().min(1),
    caseId: z.string().min(1),
    releaseId: z.string().min(1),
    releaseManifestDigest: z.string().regex(SHA256),
    releaseBundleDigest: z.string().regex(SHA256),
    registryEntryDigest: z.string().regex(SHA256),
    eventKind: z.enum([
      "registry_entry_published",
      "release_bundle_distributed",
    ]),
    evidenceClass: z.enum([
      "synthetic_qualification",
      "observed_external",
    ]),
    channel: z.enum([
      "web",
      "source_repository_release",
      "artifact_repository",
      "other",
    ]),
    publisher: z.string().min(1),
    sourceLocator: z.string().min(1),
    targetContentDigest: z.string().regex(SHA256),
    publishedAt: z.string().refine(validDate, "Invalid date-time."),
    observedAt: z.string().refine(validDate, "Invalid date-time."),
    artifactIds: z.array(z.string().min(1)).min(1),
    syntheticQualificationOnly: z.boolean(),
    publicRegistryPublished: z.boolean(),
    publicReleaseOccurred: z.boolean(),
    receiptDigest: z.string().regex(SHA256),
  })
  .strict();

const RequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    receipt: ReceiptSchema,
    artifacts: z.array(ArtifactSchema).min(1),
    admittedAt: z.string().refine(validDate, "Invalid date-time."),
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

export function validateExternalPublicationReceiptRequest(
  input: unknown,
): GarpaValidationResult<ExternalPublicationReceiptRequest> {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch (error) {
      return {
        ok: false,
        errors: [`Invalid JSON: ${(error as Error).message}`],
      };
    }
  }

  const parsed = RequestSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, errors: formatIssues(parsed.error) };
  }

  const request = parsed.data as ExternalPublicationReceiptRequest;
  const errors: string[] = [];
  for (const id of duplicates(request.artifacts.map((item) => item.artifactId))) {
    errors.push(`artifacts contains duplicate artifactId "${id}".`);
  }
  for (const id of duplicates(request.receipt.artifactIds)) {
    errors.push(`receipt.artifactIds contains duplicate artifactId "${id}".`);
  }
  if (Date.parse(request.receipt.observedAt) < Date.parse(request.receipt.publishedAt)) {
    errors.push("receipt.observedAt must not predate receipt.publishedAt.");
  }
  if (Date.parse(request.admittedAt) < Date.parse(request.receipt.observedAt)) {
    errors.push("admittedAt must not predate receipt.observedAt.");
  }

  if (errors.length > 0) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }
  return { ok: true, errors: [], value: request };
}
