import type {
  ArchitectureGateResult,
  CandidateArchitecture,
} from "./garpaArchitecture";
import type {
  CommonsSeededSubstitutionRequest,
  CommonsSeededSubstitutionResult,
} from "./garpaCommonsSeededSubstitution";

export interface CommonsSeededArchitectureRequest {
  schemaVersion: 1;
  seededSubstitutionRequest: CommonsSeededSubstitutionRequest;
  expectedSeededSubstitutionResultDigest: string;
  architecture: CandidateArchitecture;
  assembledAt: string;
}

export type CommonsSeededArchitectureFindingState =
  | "seeded_substitution_result_mismatch"
  | "seeded_substitution_not_admitted"
  | "architecture_case_mismatch"
  | "substitution_plan_digest_mismatch"
  | "seeded_component_selection_missing"
  | "seeded_component_mapping_mismatch"
  | "seeded_component_configuration_mismatch"
  | "architecture_validation_failed";

export interface CommonsSeededArchitectureFinding {
  state: CommonsSeededArchitectureFindingState;
  componentId?: string;
  reason: string;
  requiredAction: string;
}

export type CommonsSeededArchitectureState =
  | "seeded_architecture_blocked"
  | "seeded_architecture_incomplete"
  | "seeded_architecture_admitted";

export interface CommonsSeededArchitectureResult {
  passed: boolean;
  state: CommonsSeededArchitectureState;
  seededSubstitutionResult: CommonsSeededSubstitutionResult;
  seededSubstitutionResultDigest: string;
  substitutionPlanDigest: string;
  seededComponentIds: string[];
  selectedSeededComponentIds: string[];
  findings: CommonsSeededArchitectureFinding[];
  architectureValidationErrors: string[];
  architectureGate?: ArchitectureGateResult;
  architecture?: CandidateArchitecture;
  pullList: string[];
  prohibitedTransitions: string[];
}
