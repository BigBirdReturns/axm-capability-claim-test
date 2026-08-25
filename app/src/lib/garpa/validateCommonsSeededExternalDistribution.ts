import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type {
  CommonsSeededDistributionEvidenceArtifact,
  CommonsSeededExternalDistributionEnvelope,
  CommonsSeededExternalDistributionObservation,
  CommonsSeededExternalDistributionRequest,
} from "../../types/garpaCommonsSeededExternalDistribution";
import type { ReleaseFileRecord } from "../../types/garpaRelease";
import { validateCommonsSeededPublicRegistryRequest } from "./validateCommonsSeededPublicRegistry";

const SHA256 = /^[a-f0-9]{64}$/i;

function validDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

const FileRecordSchema = z
  .object({
    path: z.string().min(1),
    sha256: z.string().regex(SHA256),
    byteLength: z.number().int().nonnegative(),
    mediaType: z.string().optional(),
    role: z
      .enum([
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
      ])
      .optional(),
    required: z.boolean().optional(),
  })
  .strict();

const EvidenceArtifactSchema = z
  .object({
    artifactId: z.string().min(1),
    sha256: z.string().regex(SHA256),
    mediaType: z.string().min(1),
    uri: z.string().min(1),
    role: z.enum([
      "platform_receipt",
      "retrieval_capture",
      "content_manifest",
      "registry_snapshot",
      "qualification_fixture",
      "other",
    ]),
    evidenceControl: z.enum([
      "claimant_controlled",
      "commercially_related",
      "externally_attributed",
      "independent",
      "local_measured",
      "unknown",
    ]),
    capturedAt: z.string().refine(validDate, "Invalid date-time."),
  })
  .strict();

const ObservationSchema = z
  .object({
    schemaVersion: z.literal(1),
    distributionId: z.string().min(1),
    mode: z.enum([
      "qualification_fixture",
      "observed_external_event",
    ]),
    eventKind: z.enum([
      "release_distribution",
      "registry_publication",
      "release_and_registry_publication",
    ]),
    channel: z.enum([
      "public_web",
      "public_repository_release",
      "public_object_storage",
      "public_registry_export",
      "other",
    ]),
    destinationUri: z.string().min(1),
    caseId: z.string().min(1),
    releaseId: z.string().min(1),
    releaseNumber: z.literal(1),
    releaseManifestDigest: z.string().regex(SHA256),
    releaseBundleDigest: z.string().regex(SHA256),
    registryEntryDigest: z.string().regex(SHA256),
    publishedAt: z.string().refine(validDate, "Invalid date-time."),
    observedAt: z.string().refine(validDate, "Invalid date-time."),
    externallyAccessible: z.boolean(),
    syntheticFixture: z.boolean(),
    observedFiles: z.array(FileRecordSchema).min(1),
    evidenceArtifacts: z.array(EvidenceArtifactSchema).min(1),
    observationDigest: z.string().regex(SHA256),
  })
  .strict();

const EnvelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    distributionReceiptId: z.string().min(1),
    caseId: z.string().min(1),
    releaseId: z.string().min(1),
    releaseNumber: z.literal(1),
    releaseManifestDigest: z.string().regex(SHA256),
    releaseBundleDigest: z.string().regex(SHA256),
    registryEntryDigest: z.string().regex(SHA256),
    seededPublicRegistryResultDigest: z.string().regex(SHA256),
    distributionObservationDigest: z.string().regex(SHA256),
    observedFileSetDigest: z.string().regex(SHA256),
    evidenceArtifactSetDigest: z.string().regex(SHA256),
    mode: z.enum([
      "qualification_fixture",
      "observed_external_event",
    ]),
    eventKind: z.enum([
      "release_distribution",
      "registry_publication",
      "release_and_registry_publication",
    ]),
    evaluatedAt: z.string().refine(validDate, "Invalid date-time."),
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

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

export function validateCommonsSeededExternalDistributionRequest(
  input: unknown,
): GarpaValidationResult<CommonsSeededExternalDistributionRequest> {
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
        "Commons-seeded external-distribution request must be an object.",
      ],
    };
  }

  const record = value as Record<string, unknown>;
  const errors: string[] = [];
  if (record.schemaVersion !== 1) {
    errors.push("schemaVersion must equal 1.");
  }
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

  const observation = ObservationSchema.safeParse(
    record.distributionObservation,
  );
  if (!observation.success) {
    errors.push(...formatIssues(observation.error));
  }
  const envelope = EnvelopeSchema.safeParse(
    record.distributionEnvelope,
  );
  if (!envelope.success) {
    errors.push(...formatIssues(envelope.error));
  }

  if (observation.success) {
    for (const path of duplicates(
      observation.data.observedFiles.map((file: ReleaseFileRecord) => file.path),
    )) {
      errors.push(
        `distributionObservation.observedFiles contains duplicate path "${path}".`,
      );
    }
    for (const artifactId of duplicates(
      observation.data.evidenceArtifacts.map(
        (artifact: CommonsSeededDistributionEvidenceArtifact) =>
          artifact.artifactId,
      ),
    )) {
      errors.push(
        `distributionObservation.evidenceArtifacts contains duplicate artifactId "${artifactId}".`,
      );
    }
  }

  if (
    errors.length > 0 ||
    !registry.value ||
    !observation.success ||
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
      distributionObservation:
        observation.data as CommonsSeededExternalDistributionObservation,
      distributionEnvelope:
        envelope.data as CommonsSeededExternalDistributionEnvelope,
      admittedAt: record.admittedAt as string,
    },
  };
}
