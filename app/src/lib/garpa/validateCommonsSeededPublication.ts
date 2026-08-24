import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type {
  CommonsSeededPublicationEnvelope,
  CommonsSeededPublicationRequest,
} from "../../types/garpaCommonsSeededPublication";
import { validatePublicationPackage } from "./validatePublicationPackage";
import { validateCommonsSeededVendorParityRequest } from "./validateCommonsSeededVendorParity";

const SHA256 = /^[a-f0-9]{64}$/i;

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function validDate(value: unknown): value is string {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}

const ArtifactSchema = z
  .object({
    artifactId: z.string().min(1),
    sha256: z.string().regex(SHA256),
    mediaType: z.string().min(1),
    path: z.string().min(1),
    capturedAt: z.string().refine((value) => validDate(value), "Invalid date-time."),
  })
  .strict();

const EnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    publicationId: z.string().min(1),
    caseId: z.string().min(1),
    caseIndexDigest: z.string().regex(SHA256),
    missionOutcomeDigest: z.string().regex(SHA256),
    qualificationContractDigest: z.string().regex(SHA256),
    asBuiltReceiptDigest: z.string().regex(SHA256),
    campaignPreflightReceiptDigest: z.string().regex(SHA256),
    runSetDigest: z.string().regex(SHA256),
    seededMissionEvaluationResultDigest: z.string().regex(SHA256),
    seededVendorParityResultDigest: z.string().regex(SHA256),
    vendorParityEvaluationDigest: z.string().regex(SHA256),
    publicationPackageDigest: z.string().regex(SHA256),
    claimSetDigest: z.string().regex(SHA256),
    upstreamDigestSetDigest: z.string().regex(SHA256),
    artifactSetDigest: z.string().regex(SHA256),
    publicationArtifacts: z.array(ArtifactSchema),
    evaluatedAt: z.string().refine((value) => validDate(value), "Invalid date-time."),
    unrestrictedEquivalenceClaimed: z.literal(false),
    deploymentAuthorityClaimed: z.literal(false),
    releaseAuthorityClaimed: z.literal(false),
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

export function validateCommonsSeededPublicationRequest(
  input: unknown,
): GarpaValidationResult<CommonsSeededPublicationRequest> {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch (error) {
      return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["Commons-seeded publication request must be an object."] };
  }
  const record = value as Record<string, unknown>;
  const errors: string[] = [];
  if (record.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (
    !nonEmpty(record.expectedSeededVendorParityResultDigest) ||
    !SHA256.test(record.expectedSeededVendorParityResultDigest)
  ) {
    errors.push("expectedSeededVendorParityResultDigest must be a SHA-256 hex digest.");
  }
  if (!validDate(record.admittedAt)) errors.push("admittedAt must be a valid date-time.");

  const parity = validateCommonsSeededVendorParityRequest(
    record.seededVendorParityRequest,
  );
  errors.push(
    ...parity.errors.map((error) => `seededVendorParityRequest: ${error}`),
  );
  const publication = validatePublicationPackage(record.publicationPackage);
  errors.push(
    ...publication.errors.map((error) => `publicationPackage: ${error}`),
  );
  const envelope = EnvelopeSchema.safeParse(record.publicationEnvelope);
  if (!envelope.success) errors.push(...formatIssues(envelope.error));

  if (
    errors.length > 0 ||
    !parity.value ||
    !publication.value ||
    !envelope.success
  ) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }
  const artifactIds = envelope.data.publicationArtifacts.map(
    (artifact) => artifact.artifactId,
  );
  if (new Set(artifactIds).size !== artifactIds.length) {
    return {
      ok: false,
      errors: ["publicationEnvelope.publicationArtifacts contains duplicate artifact IDs."],
    };
  }
  return {
    ok: true,
    errors: [],
    value: {
      schemaVersion: 1,
      seededVendorParityRequest: parity.value,
      expectedSeededVendorParityResultDigest:
        record.expectedSeededVendorParityResultDigest as string,
      publicationPackage: publication.value,
      publicationEnvelope: envelope.data as CommonsSeededPublicationEnvelope,
      admittedAt: record.admittedAt as string,
    },
  };
}
