import type { ClaimPacket } from "./garpa";
import type { ComponentObservation } from "./garpaCommons";
import type {
  CommonsTransferRequest,
  CommonsTransferResult,
  CommonsTransferredNomination,
} from "./garpaCommonsTransfer";
import type { ComponentCandidate } from "./garpaSubstitution";

export interface CommonsComponentProjectionIntent {
  projectionId: string;
  nominationId: string;
  candidate: ComponentCandidate;
}

export interface CommonsComponentProjectionRequest {
  schemaVersion: 1;
  transferRequest: CommonsTransferRequest;
  expectedTransferResultDigest: string;
  targetClaimPacket: ClaimPacket;
  projections: CommonsComponentProjectionIntent[];
  projectedAt: string;
}

export type CommonsComponentProjectionFindingState =
  | "transfer_result_mismatch"
  | "transfer_candidate_missing"
  | "nomination_not_candidate_input"
  | "source_not_component_observation"
  | "candidate_identity_mismatch"
  | "target_mapping_mismatch"
  | "target_identity_evidence_missing"
  | "target_performance_unearned"
  | "target_availability_unresolved"
  | "target_price_unresolved"
  | "target_license_unresolved"
  | "source_boundary_not_carried"
  | "target_lifecycle_invalid"
  | "duplicate_projection";

export interface CommonsComponentProjectionFinding {
  state: CommonsComponentProjectionFindingState;
  projectionId?: string;
  nominationId?: string;
  candidateId?: string;
  reason: string;
  requiredAction: string;
}

export interface CommonsProjectedComponent {
  projectionId: string;
  nominationId: string;
  transferDisposition: CommonsTransferredNomination["disposition"];
  source: {
    catalogObjectId: string;
    revisionId: string;
    objectDigest: string;
    sourceCaseId: string;
    sourceReleaseId: string;
    sourceReleaseDigest: string;
    observation: ComponentObservation;
  };
  candidate: ComponentCandidate;
  requiredEvidencePulls: string[];
  requiredQualificationTests: string[];
  knownMismatches: string[];
}

export interface CommonsSubstitutionSeed {
  schemaVersion: 1;
  caseId: string;
  capabilityGraphDigest: string;
  transferResultDigest: string;
  componentCandidateIds: string[];
  components: ComponentCandidate[];
  mappedFunctionIds: string[];
  mappedInterfaceIds: string[];
  unmappedRequiredFunctionIds: string[];
  unmappedRequiredInterfaceIds: string[];
  requiredCompatibilityInterfaceIds: string[];
  requiredQualificationTests: string[];
  prohibitedTransitions: string[];
}

export type CommonsComponentProjectionState =
  | "projection_blocked"
  | "projection_partially_admitted"
  | "projection_admitted";

export interface CommonsComponentProjectionResult {
  passed: boolean;
  state: CommonsComponentProjectionState;
  transferResult: CommonsTransferResult;
  transferResultDigest: string;
  admittedProjectionIds: string[];
  blockedProjectionIds: string[];
  projectedComponents: CommonsProjectedComponent[];
  findings: CommonsComponentProjectionFinding[];
  pullList: string[];
  seed?: CommonsSubstitutionSeed;
  prohibitedTransitions: string[];
}
