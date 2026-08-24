import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type {
  CommonsSeededPublicRegistryEnvelope,
  CommonsSeededPublicRegistryRequest,
} from "../../types/garpaCommonsSeededPublicRegistry";
import { validateRegistryReleaseUpdateRequest } from "./validateCaseRegistry";
import { validateCommonsSeededReleaseRequest } from "./validateCommonsSeededRelease";

const SHA256 = /^[a-f0-9]{64}$/i;

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function validDate(value: unknown): value is string {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}

const EnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    registryReceiptId: z.string().min(1),
    caseId: z.string().min(1),
    releaseId: z.string().min(1),
    releaseNumber: z.literal(1),
    releaseManifestDigest: z.string().regex(SHA256),
    releaseBundleDigest: z.string().regex(SHA256),
    seededReleaseResultDigest: z.string().regex(SHA256),
    currentEntryDigest: z.string().regex(SHA256),
    registryUpdateRequestDigest: z.string().regex(SHA256),
    identityPatchDigest: z.string().regex(SHA256),
    registryUpdateGateResultDigest: z.string().regex(SHA256),
    nextEntryDigest: z.string().regex(SHA256),
    releaseHistoryDigest: z.string().regex(SHA256),
    updatedAt: z.string().refine((value) => validDate(value), "Invalid date-time."),
    publicRegistryPublished: z.literal(false),
    publicReleaseOccurred: z.literal(false),
    deploymentAuthorityClaimed: z.literal(false),
    unrestrictedEquivalenceClaimed: z.literal(false),
    envelopeDigest: z.string().regex(SHA256),
  })
  .strict();

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export function validateCommonsSeededPublicRegistryRequest(
  input: unknown,
): GarpaValidationResult<CommonsSeededPublicRegistryRequest> {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch (error) {
      return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["Commons-seeded public-registry request must be an object."] };
  }
  const record = value as Record<string, unknown>;
  const errors: string[] = [];
  if (record.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (
    !nonEmpty(record.expectedSeededReleaseResultDigest) ||
    !SHA256.test(record.expectedSeededReleaseResultDigest)
  ) {
    errors.push("expectedSeededReleaseResultDigest must be a SHA-256 hex digest.");
  }
  if (!validDate(record.admittedAt)) errors.push("admittedAt must be a valid date-time.");

  const release = validateCommonsSeededReleaseRequest(
    record.seededReleaseRequest,
  );
  errors.push(
    ...release.errors.map((error) => `seededReleaseRequest: ${error}`),
  );
  const update = validateRegistryReleaseUpdateRequest(
    record.registryUpdateRequest,
  );
  errors.push(
    ...update.errors.map((error) => `registryUpdateRequest: ${error}`),
  );
  const envelope = EnvelopeSchema.safeParse(record.registryEnvelope);
  if (!envelope.success) errors.push(...formatIssues(envelope.error));

  if (
    errors.length > 0 ||
    !release.value ||
    !update.value ||
    !envelope.success
  ) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }
  return {
    ok: true,
    errors: [],
    value: {
      schemaVersion: 1,
      seededReleaseRequest: release.value,
      expectedSeededReleaseResultDigest:
        record.expectedSeededReleaseResultDigest as string,
      registryUpdateRequest: update.value,
      registryEnvelope:
        envelope.data as CommonsSeededPublicRegistryEnvelope,
      admittedAt: record.admittedAt as string,
    },
  };
}
