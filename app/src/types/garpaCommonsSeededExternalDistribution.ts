import type { EvidenceControl } from "./garpa";
import type { ReleaseFileRecord } from "./garpaRelease";
import type {
  CommonsSeededPublicRegistryRequest,
  CommonsSeededPublicRegistryResult,
} from "./garpaCommonsSeededPublicRegistry";

export type CommonsSeededExternalDistributionMode =
  | "qualification_fixture"
  | "observed_external_event";

export type CommonsSeededExternalDistributionEventKind =
  | "release_distribution"
  | "registry_publication"
  | "release_and_registry_publication";

export type CommonsSeededExternalDistributionChannel =
  | "public_web"
  | "public_repository_release"
  | "public_object_storage"
  | "public_registry_export"
  | "other";

export type CommonsSeededDistributionEvidenceRole =
  | "platform_receipt"
  | "retrieval_capture"
  | "content_manifest"
  | "registry_snapshot"
  | "qualification_fixture"
  | "other";

export interface CommonsSeededDistributionEvidenceArtifact {
  artifactId: string;
  sha256: string;
  mediaType: string;
  uri: string;
  role: CommonsSeededDistributionEvidenceRole;
  evidenceControl: EvidenceControl;
  capturedAt: string;
}

export interface CommonsSeededExternalDistributionObservation {
  schemaVersion: 1;
  distributionId: string;
  mode: CommonsSeededExternalDistributionMode;
  eventKind: CommonsSeededExternalDistributionEventKind;
  channel: CommonsSeededExternalDistributionChannel;
  destinationUri: string;
  caseId: string;
  releaseId: string;
  releaseNumber: 1;
  releaseManifestDigest: string;
  releaseBundleDigest: string;
  registryEntryDigest: string;
  publishedAt: string;
  observedAt: string;
  externallyAccessible: boolean;
  syntheticFixture: boolean;
  observedFiles: ReleaseFileRecord[];
  evidenceArtifacts: CommonsSeededDistributionEvidenceArtifact[];
  observationDigest: string;
}

export interface CommonsSeededExternalDistributionEnvelope {
  schemaVersion: 1;
  distributionReceiptId: string;
  caseId: string;
  releaseId: string;
  releaseNumber: 1;
  releaseManifestDigest: string;
  releaseBundleDigest: string;
  registryEntryDigest: string;
  seededPublicRegistryResultDigest: string;
  distributionObservationDigest: string;
  observedFileSetDigest: string;
  evidenceArtifactSetDigest: string;
  mode: CommonsSeededExternalDistributionMode;
  eventKind: CommonsSeededExternalDistributionEventKind;
  evaluatedAt: string;
  publicRegistryPublished: boolean;
  publicReleaseOccurred: boolean;
  deploymentAuthorityClaimed: false;
  unrestrictedEquivalenceClaimed: false;
  envelopeDigest: string;
}

export interface CommonsSeededExternalDistributionRequest {
  schemaVersion: 1;
  seededPublicRegistryRequest: CommonsSeededPublicRegistryRequest;
  expectedSeededPublicRegistryResultDigest: string;
  distributionObservation: CommonsSeededExternalDistributionObservation;
  distributionEnvelope: CommonsSeededExternalDistributionEnvelope;
  admittedAt: string;
}

export type CommonsSeededExternalDistributionFindingState =
  | "public_registry_result_mismatch"
  | "public_registry_record_not_admitted"
  | "governing_release_pointer_mismatch"
  | "distribution_observation_digest_mismatch"
  | "distribution_envelope_digest_mismatch"
  | "distribution_case_mismatch"
  | "distribution_release_mismatch"
  | "distribution_registry_entry_mismatch"
  | "distribution_mode_mismatch"
  | "distribution_uri_invalid"
  | "distribution_time_order_invalid"
  | "distribution_file_set_mismatch"
  | "distribution_artifact_set_mismatch"
  | "distribution_artifact_custody_missing"
  | "distribution_artifact_time_order_invalid"
  | "external_event_evidence_insufficient"
  | "synthetic_fixture_publication_attempted"
  | "public_registry_flag_mismatch"
  | "public_release_flag_mismatch"
  | "deployment_authority_attempted"
  | "unrestricted_equivalence_attempted"
  | "external_distribution_validation_failed";

export interface CommonsSeededExternalDistributionFinding {
  state: CommonsSeededExternalDistributionFindingState;
  artifactId?: string;
  path?: string;
  reason: string;
  requiredAction: string;
}

export type CommonsSeededExternalDistributionState =
  | "seeded_external_distribution_blocked"
  | "seeded_external_distribution_fixture_admitted"
  | "seeded_external_distribution_observed";

export interface CommonsSeededExternalDistributionResult {
  passed: boolean;
  state: CommonsSeededExternalDistributionState;
  receiptAdmitted: boolean;
  eventObserved: boolean;
  publicRegistryPublished: boolean;
  publicReleaseOccurred: boolean;
  mode?: CommonsSeededExternalDistributionMode;
  eventKind?: CommonsSeededExternalDistributionEventKind;
  seededPublicRegistryResult?: CommonsSeededPublicRegistryResult;
  seededPublicRegistryResultDigest: string;
  distributionObservationDigest: string;
  distributionEnvelopeDigest: string;
  observedFileSetDigest: string;
  evidenceArtifactSetDigest: string;
  expectedFiles: ReleaseFileRecord[];
  observedFiles: ReleaseFileRecord[];
  evidenceArtifacts: CommonsSeededDistributionEvidenceArtifact[];
  findings: CommonsSeededExternalDistributionFinding[];
  validationErrors: string[];
  pullList: string[];
  prohibitedTransitions: string[];
}
