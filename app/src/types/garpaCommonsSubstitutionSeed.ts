import type { CommonsComponentProjectionResult } from "./garpaCommonsProjection";
import type { SubstitutionPlan } from "./garpaSubstitution";

export interface CommonsSubstitutionSeedRequest {
  schemaVersion: 1;
  insertionId: string;
  projectionResult: CommonsComponentProjectionResult;
  targetPlan: SubstitutionPlan;
  expectedTargetCaseId: string;
  expectedCapabilityGraphDigest: string;
  createdAt: string;
}

export type CommonsSubstitutionSeedFindingState =
  | "projection_not_admitted"
  | "projection_not_substitution_ready"
  | "target_plan_invalid"
  | "target_case_mismatch"
  | "capability_graph_digest_mismatch"
  | "component_identity_conflict";

export interface CommonsSubstitutionSeedFinding {
  state: CommonsSubstitutionSeedFindingState;
  reason: string;
  requiredAction: string;
}

export interface CommonsSubstitutionSeedResult {
  passed: boolean;
  state:
    | CommonsSubstitutionSeedFindingState
    | "substitution_plan_seeded"
    | "substitution_plan_noop";
  findings: CommonsSubstitutionSeedFinding[];
  insertedComponentId?: string;
  noopComponentId?: string;
  plan?: SubstitutionPlan;
  downstreamSubstitutionGateRequired: true;
  prohibitedTransitions: string[];
}
