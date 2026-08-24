import type {
  PublicationClaim,
  PublicationGateResult,
  PublicationGateState,
  PublicationPackage,
} from "./garpaPublication";
import type {
  CommonsSeededVendorParityRequest,
  CommonsSeededVendorParityResult,
} from "./garpaCommonsSeededVendorParity";

export interface CommonsSeededPublicationArtifactRef {
  artifactId: string;
  sha256: string;
  mediaType: string;
  path: string;
  capturedAt: string;
}

export interface CommonsSeededPublicationEnvelope {
  schemaVersion: 1;
  publicationId: string;
  caseId: string;
  caseIndexDigest: string;
  missionOutcomeDigest: string;
  qualificationContractDigest: string;
  asBuiltReceiptDigest: string;
  campaignPreflightReceiptDigest: string;
  runSetDigest: string;
  seededMissionEvaluationResultDigest: string;
  seededVendorParityResultDigest: string;
  vendorParityEvaluationDigest: string;
  publicationPackageDigest: string;
  claimSetDigest: string;
  upstreamDigestSetDigest: string;
  artifactSetDigest: string;
  publicationArtifacts: CommonsSeededPublicationArtifactRef[];
  evaluatedAt: string;
  unrestrictedEquivalenceClaimed: false;
  deploymentAuthorityClaimed: false;
  releaseAuthorityClaimed: false;
  publicReleaseOccurred: false;
  envelopeDigest: string;
}

export interface CommonsSeededPublicationRequest {
  schemaVersion: 1;
  seededVendorParityRequest: CommonsSeededVendorParityRequest;
  expectedSeededVendorParityResultDigest: string;
  publicationPackage: PublicationPackage;
  publicationEnvelope: CommonsSeededPublicationEnvelope;
  admittedAt: string;
}

export type CommonsSeededPublicationFindingState =
  | "vendor_parity_result_mismatch"
  | "vendor_parity_not_admitted"
  | "publication_package_digest_mismatch"
  | "publication_envelope_digest_mismatch"
  | "publication_case_mismatch"
  | "publication_upstream_digest_mismatch"
  | "publication_case_index_mismatch"
  | "publication_claim_set_mismatch"
  | "publication_vendor_parity_state_mismatch"
  | "publication_disposition_mismatch"
  | "publication_time_order_invalid"
  | "rights_review_time_order_invalid"
  | "safety_review_time_order_invalid"
  | "publication_artifact_custody_missing"
  | "publication_artifact_unexpected"
  | "publication_artifact_record_mismatch"
  | "publication_artifact_time_order_invalid"
  | "ordinary_publication_gate_failed"
  | "ordinary_publication_state_missing"
  | "unrestricted_equivalence_attempted"
  | "deployment_authority_attempted"
  | "release_authority_attempted"
  | "public_release_attempted"
  | "publication_validation_failed";

export interface CommonsSeededPublicationFinding {
  state: CommonsSeededPublicationFindingState;
  claimId?: string;
  artifactId?: string;
  reason: string;
  requiredAction: string;
}

export type CommonsSeededPublicationState =
  | "seeded_publication_blocked"
  | "seeded_publication_incomplete"
  | "seeded_publication_admitted";

export interface CommonsSeededPublicationResult {
  passed: boolean;
  state: CommonsSeededPublicationState;
  publicationReady: boolean;
  publicationState?: PublicationGateState;
  seededVendorParityResult?: CommonsSeededVendorParityResult;
  seededVendorParityResultDigest: string;
  publicationPackageDigest: string;
  publicationEnvelopeDigest: string;
  claimSetDigest: string;
  upstreamDigestSetDigest: string;
  artifactSetDigest: string;
  ordinaryPublicationGate?: PublicationGateResult;
  ordinaryPublicationGateResultDigest: string;
  expectedUpstreamDigests: Record<string, string>;
  expectedClaims: PublicationClaim[];
  publicationPackage?: PublicationPackage;
  publicationArtifactIds: string[];
  findings: CommonsSeededPublicationFinding[];
  validationErrors: string[];
  pullList: string[];
  prohibitedTransitions: string[];
}
