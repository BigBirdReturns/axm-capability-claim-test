import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type {
  CommonsSeededExternalPublicationEnvelope,
  CommonsSeededExternalPublicationRequest,
} from "../../types/garpaCommonsSeededExternalPublication";
import { validateExternalPublicationReceiptRequest } from "./validateExternalPublicationReceipt";
import { validateCommonsSeededPublicRegistryRequest } from "./validateCommonsSeededPublicRegistry";

const SHA256 = /^[a-f0-9]{64}$/i;

function validDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

const EnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    externalPublicationReceiptId: z.string().min(1),
    caseId: z.string().min(1),
    releaseId: z.string().min(1),
    releaseNumber: z.literal(1),
    releaseManifestDigest: z.string().regex(SHA256),
    releaseBundleDigest: z.string().regex(SHA256),
    seededPublicRegistryResultDigest: z.string().regex(SHA256),
    registryEntryDigest: z.string().regex(SHA256),
    externalPublicationRequestDigest: z.string().regex(SHA256),
    externalPublicationReceiptDigest: z.string().regex(SHA256),
    externalArtifactSetDigest: z.string().regex(SHA256),
    ordinaryReceiptResultDigest: z.string().regex(SHA256),
    evidenceClass: z.enum([
      "synthetic_qualification",
      "observed_external",
    ]),
    eventKind: z.enum([
      "registry_entry_published",
      "release_bundle_distributed",
    ]),
    observedAt: z.string().refine(validDate, "Invalid date-time."),
    syntheticQualificationOnly: z.boolean(),
    externalEventObserved: z.boolean(),
    publicRegistryPublished: z.boolean(),
    publicReleaseOccurred: z.boolean(),
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

export function validateCommonsSeededExternalPublicationRequest(
  input: unknown,
): GarpaValidationResult<CommonsSeededExternalPublicationRequest> {
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
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      errors: [
        "Commons-seeded external-publication request must be an object.",
      ],
    };
  }

  const record = value as Record<string, unknown>;
  const errors: string[] = [];
  if (record.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (
    typeof record.expectedSeededPublicRegistryResultDigest !== "string" ||
    !SHA256.test(record.expectedSeededPublicRegistryResultDigest)
  ) {
    errors.push(
      "expectedSeededPublicRegistryResultDigest must be a SHA-256 hex digest.",
    );
  }
  if (
    typeof record.admittedAt !== "string" ||
    !validDate(record.admittedAt)
  ) {
    errors.push("admittedAt must be a valid date-time.");
  }

  const registry = validateCommonsSeededPublicRegistryRequest(
    record.seededPublicRegistryRequest,
  );
  errors.push(
    ...registry.errors.map(
      (error) => `seededPublicRegistryRequest: ${error}`,
    ),
  );
  const receipt = validateExternalPublicationReceiptRequest(
    record.externalPublicationRequest,
  );
  errors.push(
    ...receipt.errors.map(
      (error) => `externalPublicationRequest: ${error}`,
    ),
  );
  const envelope = EnvelopeSchema.safeParse(record.publicationEnvelope);
  if (!envelope.success) errors.push(...formatIssues(envelope.error));

  if (
    errors.length > 0 ||
    !registry.value ||
    !receipt.value ||
    !envelope.success
  ) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }

  return {
    ok: true,
    errors: [],
    value: {
      schemaVersion: 1,
      seededPublicRegistryRequest: registry.value,
      expectedSeededPublicRegistryResultDigest:
        record.expectedSeededPublicRegistryResultDigest as string,
      externalPublicationRequest: receipt.value,
      publicationEnvelope:
        envelope.data as CommonsSeededExternalPublicationEnvelope,
      admittedAt: record.admittedAt as string,
    },
  };
}
