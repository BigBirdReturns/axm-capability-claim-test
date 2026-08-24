import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type {
  CommonsSeededVendorParityEnvelope,
  CommonsSeededVendorParityRequest,
} from "../../types/garpaCommonsSeededVendorParity";
import { validateCommonsSeededMissionEvaluationRequest } from "./validateCommonsSeededMissionEvaluation";
import { validateVendorParityRequest } from "./validateVendorParity";

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
    parityId: z.string().min(1),
    caseId: z.string().min(1),
    missionOutcomeDigest: z.string().regex(SHA256),
    qualificationContractDigest: z.string().regex(SHA256),
    asBuiltReceiptDigest: z.string().regex(SHA256),
    campaignPreflightReceiptDigest: z.string().regex(SHA256),
    runSetDigest: z.string().regex(SHA256),
    seededMissionEvaluationResultDigest: z.string().regex(SHA256),
    seededMissionEvaluationEnvelopeDigest: z.string().regex(SHA256),
    custodiedMissionEvaluationResultDigest: z.string().regex(SHA256),
    vendorParityRequestDigest: z.string().regex(SHA256),
    garpaObservationSetDigest: z.string().regex(SHA256),
    vendorObservationSetDigest: z.string().regex(SHA256),
    vendorOffering: z.string().min(1),
    vendorVersion: z.string().optional(),
    vendorArtifacts: z.array(ArtifactSchema),
    evaluatedAt: z.string().refine((value) => validDate(value), "Invalid date-time."),
    qualificationTransferred: z.literal(false),
    unrestrictedEquivalenceClaimed: z.literal(false),
    deploymentAuthorityClaimed: z.literal(false),
    publicationAuthorityClaimed: z.literal(false),
    envelopeDigest: z.string().regex(SHA256),
  })
  .strict();

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export function validateCommonsSeededVendorParityRequest(
  input: unknown,
): GarpaValidationResult<CommonsSeededVendorParityRequest> {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch (error) {
      return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["Commons-seeded vendor-parity request must be an object."] };
  }
  const record = value as Record<string, unknown>;
  const errors: string[] = [];
  if (record.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (
    !nonEmpty(record.expectedSeededMissionEvaluationResultDigest) ||
    !SHA256.test(record.expectedSeededMissionEvaluationResultDigest)
  ) {
    errors.push("expectedSeededMissionEvaluationResultDigest must be a SHA-256 hex digest.");
  }
  if (!validDate(record.admittedAt)) errors.push("admittedAt must be a valid date-time.");

  const mission = validateCommonsSeededMissionEvaluationRequest(
    record.seededMissionEvaluationRequest,
  );
  errors.push(
    ...mission.errors.map((error) => `seededMissionEvaluationRequest: ${error}`),
  );
  const parity = validateVendorParityRequest(record.vendorParityRequest);
  errors.push(...parity.errors.map((error) => `vendorParityRequest: ${error}`));
  const envelope = EnvelopeSchema.safeParse(record.parityEnvelope);
  if (!envelope.success) errors.push(...formatIssues(envelope.error));

  if (
    errors.length > 0 ||
    !mission.value ||
    !parity.value ||
    !envelope.success
  ) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }
  const artifactIds = envelope.data.vendorArtifacts.map((artifact) => artifact.artifactId);
  if (new Set(artifactIds).size !== artifactIds.length) {
    return { ok: false, errors: ["parityEnvelope.vendorArtifacts contains duplicate artifact IDs."] };
  }
  return {
    ok: true,
    errors: [],
    value: {
      schemaVersion: 1,
      seededMissionEvaluationRequest: mission.value,
      expectedSeededMissionEvaluationResultDigest:
        record.expectedSeededMissionEvaluationResultDigest as string,
      vendorParityRequest: parity.value,
      parityEnvelope: envelope.data as CommonsSeededVendorParityEnvelope,
      admittedAt: record.admittedAt as string,
    },
  };
}
