import type { CapabilityGraphGateResult } from "./garpaCapability";
import type {
  CommonsComponentProjectionRequest,
  CommonsComponentProjectionResult,
} from "./garpaCommonsProjection";
import type {
  SubstitutionGateResult,
  SubstitutionPlan,
} from "./garpaSubstitution";

export interface CommonsSeededSubstitutionRequest {
  schemaVersion: 1;
  projectionRequest: CommonsComponentProjectionRequest;
  expectedProjectionResultDigest: string;
  plan: SubstitutionPlan;
  assembledAt: string;
}

export type CommonsSeededSubstitutionFindingState =
  | "projection_result_mismatch"
  | "projection_seed_missing"
  | "plan_case_mismatch"
  | "graph_digest_mismatch"
  | "seeded_component_missing"
  | "seeded_component_mutated"
  | "plan_validation_failed";

export interface CommonsSeededSubstitutionFinding {
  state: CommonsSeededSubstitutionFindingState;
  componentId?: string;
  reason: string;
  requiredAction: string;
}

export type CommonsSeededSubstitutionState =
  | "seeded_substitution_blocked"
  | "seeded_substitution_incomplete"
  | "seeded_substitution_admitted";

export interface CommonsSeededSubstitutionResult {
  passed: boolean;
  state: CommonsSeededSubstitutionState;
  projectionResult: CommonsComponentProjectionResult;
  projectionResultDigest: string;
  graphGate: CapabilityGraphGateResult;
  seededComponentIds: string[];
  targetOnlyComponentIds: string[];
  findings: CommonsSeededSubstitutionFinding[];
  planValidationErrors: string[];
  substitutionGate?: SubstitutionGateResult;
  plan?: SubstitutionPlan;
  pullList: string[];
  prohibitedTransitions: string[];
}
