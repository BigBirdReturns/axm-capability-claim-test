import type {
  GarpaReleaseManifest,
  ReleaseFileRole,
  ReleaseVerificationResult,
  ReleaseVerificationState,
} from "./garpaRelease";
import type {
  CommonsSeededPublicationRequest,
  CommonsSeededPublicationResult,
} from "./garpaCommonsSeededPublication";

export interface CommonsSeededReleaseFilePayload {
  path: string;
  mediaType: string;
  role: ReleaseFileRole;
  required: true;
  contentEncoding: "utf-8";
  content: string;
  sha256: string;
  byteLength: number;
}

export interface CommonsSeededReleaseEnvelope {
  schemaVersion: 1;
  releaseReceiptId: string;
  caseId: string;
  releaseId: string;
  releaseNumber: number;
  releaseState: "current";
  caseIndexDigest: string;
  seededPublicationResultDigest: string;
  publicationPackageDigest: string;
  publicationGateResultDigest: string;
  releaseManifestDigest: string;
  fileSetDigest: string;
  bundleDigest: string;
  verifiedAt: string;
  publicationReady: true;
  unrestrictedEquivalenceClaimed: false;
  deploymentAuthorityClaimed: false;
  registryUpdated: false;
  publicReleaseOccurred: false;
  envelopeDigest: string;
}

export interface CommonsSeededReleaseRequest {
  schemaVersion: 1;
  seededPublicationRequest: CommonsSeededPublicationRequest;
  expectedSeededPublicationResultDigest: string;
  releaseManifest: GarpaReleaseManifest;
  releaseFiles: CommonsSeededReleaseFilePayload[];
  releaseEnvelope: CommonsSeededReleaseEnvelope;
  admittedAt: string;
}

export type CommonsSeededReleaseFindingState =
  | "publication_result_mismatch"
  | "publication_record_not_admitted"
  | "publication_not_ready"
  | "release_manifest_digest_mismatch"
  | "release_envelope_digest_mismatch"
  | "release_case_mismatch"
  | "release_upstream_digest_mismatch"
  | "release_time_order_invalid"
  | "release_lineage_invalid"
  | "release_file_set_mismatch"
  | "release_file_content_mismatch"
  | "release_file_digest_mismatch"
  | "release_file_length_mismatch"
  | "release_file_metadata_mismatch"
  | "release_path_unsafe"
  | "ordinary_release_manifest_verification_failed"
  | "ordinary_release_bundle_verification_failed"
  | "unrestricted_equivalence_attempted"
  | "deployment_authority_attempted"
  | "registry_update_attempted"
  | "public_release_attempted"
  | "release_validation_failed";

export interface CommonsSeededReleaseFinding {
  state: CommonsSeededReleaseFindingState;
  path?: string;
  reason: string;
  requiredAction: string;
}

export type CommonsSeededReleaseState =
  | "seeded_release_blocked"
  | "seeded_release_incomplete"
  | "seeded_release_admitted";

export interface CommonsSeededReleaseResult {
  passed: boolean;
  state: CommonsSeededReleaseState;
  releaseVerified: boolean;
  releaseState?: ReleaseVerificationState;
  seededPublicationResult?: CommonsSeededPublicationResult;
  seededPublicationResultDigest: string;
  releaseManifestDigest: string;
  releaseEnvelopeDigest: string;
  fileSetDigest: string;
  bundleDigest: string;
  ordinaryManifestVerification?: ReleaseVerificationResult;
  ordinaryBundleVerification?: ReleaseVerificationResult;
  releaseManifest?: GarpaReleaseManifest;
  expectedFiles: CommonsSeededReleaseFilePayload[];
  releaseFiles: CommonsSeededReleaseFilePayload[];
  findings: CommonsSeededReleaseFinding[];
  validationErrors: string[];
  pullList: string[];
  prohibitedTransitions: string[];
}
