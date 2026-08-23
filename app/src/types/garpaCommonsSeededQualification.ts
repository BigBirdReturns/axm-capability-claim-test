import type { MissionOutcome } from "./garpa";
import type {
  CommonsSeededArchitectureRequest,
  CommonsSeededArchitectureResult,
} from "./garpaCommonsSeededArchitecture";
import type {
  QualificationContract,
  QualificationGateResult,
} from "./garpaQualification";

export interface CommonsSeededQualificationTestClosure {
  requirement: string;
  scenarioIds: string[];
  metricIds: string[];
  rationale: string;
}

export interface CommonsSeededQualificationBinding {
  bindingId: string;
  componentId: string;
  sourceCatalogObjectId: string;
  sourceRevisionId: string;
  sourceObjectDigest: string;
  architectureSelectionDigest: string;
  riskIds: string[];
  residualIds: string[];
  requiredTestClosures: CommonsSeededQualificationTestClosure[];
}

export interface CommonsSeededQualificationRequest {
  schemaVersion: 1;
  seededArchitectureRequest: CommonsSeededArchitectureRequest;
  expectedSeededArchitectureResultDigest: string;
  targetMissionOutcome: MissionOutcome;
  targetMissionOutcomeDigest: string;
  qualificationContract: QualificationContract;
  seededComponentBindings: CommonsSeededQualificationBinding[];
  frozenAt: string;
}

export type CommonsSeededQualificationFindingState =
  | "seeded_architecture_result_mismatch"
  | "seeded_architecture_not_admitted"
  | "mission_outcome_digest_mismatch"
  | "qualification_case_mismatch"
  | "architecture_digest_mismatch"
  | "qualification_freeze_time_mismatch"
  | "seeded_component_binding_missing"
  | "seeded_component_binding_unexpected"
  | "seeded_source_mismatch"
  | "seeded_selection_digest_mismatch"
  | "seeded_risk_coverage_mismatch"
  | "seeded_residual_coverage_mismatch"
  | "required_requalification_test_missing"
  | "requalification_test_reference_invalid"
  | "target_environment_not_exercised"
  | "qualification_validation_failed";

export interface CommonsSeededQualificationFinding {
  state: CommonsSeededQualificationFindingState;
  bindingId?: string;
  componentId?: string;
  reason: string;
  requiredAction: string;
}

export type CommonsSeededQualificationState =
  | "seeded_qualification_blocked"
  | "seeded_qualification_incomplete"
  | "seeded_qualification_admitted";

export interface CommonsSeededQualificationResult {
  passed: boolean;
  state: CommonsSeededQualificationState;
  seededArchitectureResult?: CommonsSeededArchitectureResult;
  seededArchitectureResultDigest: string;
  missionOutcomeDigest: string;
  candidateArchitectureDigest: string;
  seededComponentIds: string[];
  boundSeededComponentIds: string[];
  findings: CommonsSeededQualificationFinding[];
  qualificationValidationErrors: string[];
  qualificationGate?: QualificationGateResult;
  qualificationContract?: QualificationContract;
  pullList: string[];
  prohibitedTransitions: string[];
}
