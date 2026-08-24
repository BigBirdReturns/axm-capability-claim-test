import type {
  ParityMetricObservation,
  VendorParityEvaluation,
  VendorParityRequest,
  VendorParityState,
} from "./garpaParity";
import type {
  CommonsSeededMissionEvaluationRequest,
  CommonsSeededMissionEvaluationResult,
} from "./garpaCommonsSeededMissionEvaluation";

export interface CommonsSeededVendorArtifactRef {
  artifactId: string;
  sha256: string;
  mediaType: string;
  path: string;
  capturedAt: string;
}

export interface CommonsSeededVendorParityEnvelope {
  schemaVersion: 1;
  parityId: string;
  caseId: string;
  missionOutcomeDigest: string;
  qualificationContractDigest: string;
  asBuiltReceiptDigest: string;
  campaignPreflightReceiptDigest: string;
  runSetDigest: string;
  seededMissionEvaluationResultDigest: string;
  seededMissionEvaluationEnvelopeDigest: string;
  custodiedMissionEvaluationResultDigest: string;
  vendorParityRequestDigest: string;
  garpaObservationSetDigest: string;
  vendorObservationSetDigest: string;
  vendorOffering: string;
  vendorVersion?: string;
  vendorArtifacts: CommonsSeededVendorArtifactRef[];
  evaluatedAt: string;
  qualificationTransferred: false;
  unrestrictedEquivalenceClaimed: false;
  deploymentAuthorityClaimed: false;
  publicationAuthorityClaimed: false;
  envelopeDigest: string;
}

export interface CommonsSeededVendorParityRequest {
  schemaVersion: 1;
  seededMissionEvaluationRequest: CommonsSeededMissionEvaluationRequest;
  expectedSeededMissionEvaluationResultDigest: string;
  vendorParityRequest: VendorParityRequest;
  parityEnvelope: CommonsSeededVendorParityEnvelope;
  admittedAt: string;
}

export type CommonsSeededVendorParityFindingState =
  | "mission_evaluation_result_mismatch"
  | "mission_evaluation_not_admitted"
  | "mission_evaluation_state_mismatch"
  | "vendor_parity_request_digest_mismatch"
  | "parity_envelope_digest_mismatch"
  | "parity_case_mismatch"
  | "parity_upstream_digest_mismatch"
  | "parity_time_order_invalid"
  | "parity_metric_contract_mismatch"
  | "garpa_observation_aggregation_unsupported"
  | "garpa_observation_set_mismatch"
  | "vendor_observation_set_mismatch"
  | "vendor_identity_mismatch"
  | "vendor_artifact_custody_missing"
  | "vendor_artifact_unexpected"
  | "vendor_artifact_time_order_invalid"
  | "ordinary_vendor_parity_failed"
  | "ordinary_vendor_parity_state_missing"
  | "qualification_transfer_attempted"
  | "unrestricted_equivalence_attempted"
  | "deployment_authority_attempted"
  | "publication_authority_attempted"
  | "vendor_parity_validation_failed";

export interface CommonsSeededVendorParityFinding {
  state: CommonsSeededVendorParityFindingState;
  metricId?: string;
  scenarioId?: string;
  artifactId?: string;
  reason: string;
  requiredAction: string;
}

export type CommonsSeededVendorParityGateState =
  | "seeded_vendor_parity_blocked"
  | "seeded_vendor_parity_incomplete"
  | "seeded_vendor_parity_admitted";

export interface CommonsSeededVendorParityResult {
  passed: boolean;
  state: CommonsSeededVendorParityGateState;
  parityState?: VendorParityState;
  seededMissionEvaluationResult?: CommonsSeededMissionEvaluationResult;
  seededMissionEvaluationResultDigest: string;
  vendorParityRequestDigest: string;
  parityEnvelopeDigest: string;
  garpaObservationSetDigest: string;
  vendorObservationSetDigest: string;
  vendorParityEvaluation?: VendorParityEvaluation;
  vendorParityEvaluationDigest: string;
  derivedGarpaObservations: ParityMetricObservation[];
  vendorObservations: ParityMetricObservation[];
  vendorArtifactIds: string[];
  findings: CommonsSeededVendorParityFinding[];
  validationErrors: string[];
  pullList: string[];
  prohibitedTransitions: string[];
}
