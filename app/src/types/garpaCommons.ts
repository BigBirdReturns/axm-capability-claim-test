import type { ExecutionClass, MetricResult } from "./garpaExecution";

export type PrimitiveFunctionClass =
  | "essential"
  | "enabling"
  | "coordination"
  | "sustainment"
  | "assurance";

export interface InterfacePattern {
  name: string;
  interfaceType:
    | "data"
    | "power"
    | "mechanical"
    | "network"
    | "human"
    | "environmental"
    | "organizational";
  direction: "input" | "output" | "bidirectional";
  protocolOrFormat?: string;
  constraints: string[];
}

export interface PrimitiveImplementationRef {
  caseId: string;
  releaseId: string;
  buildReceiptDigest?: string;
  componentIds: string[];
  architecturePatternIds: string[];
  note: string;
}

export interface PrimitiveQualificationRef {
  caseId: string;
  releaseId: string;
  qualificationContractDigest: string;
  runReceiptIds: string[];
  scenarioIds: string[];
  metricIds: string[];
  executionClass: ExecutionClass;
  state:
    | "candidate"
    | "bench_observed"
    | "field_observed"
    | "repeated";
  limitations: string[];
}

export type PrimitiveMaturity =
  | "concept"
  | "candidate"
  | "bench_observed"
  | "field_observed"
  | "repeated";

export interface CapabilityPrimitive {
  primitiveId: string;
  name: string;
  purpose: string;
  functionClass: PrimitiveFunctionClass;
  inputInterfacePatterns: InterfacePattern[];
  outputInterfacePatterns: InterfacePattern[];
  operatingConstraints: string[];
  humanRoles: string[];
  observedImplementations: PrimitiveImplementationRef[];
  qualificationRefs: PrimitiveQualificationRef[];
  maturity: PrimitiveMaturity;
  residuals: string[];
  falsificationConditions: string[];
  sourceCaseIds: string[];
  sourceReleaseIds: string[];
}

export interface ComponentIdentity {
  manufacturer?: string;
  product: string;
  exactModelOrVersion: string;
  firmwareOrSoftwareVersion?: string;
}

export interface ComponentCostObservation {
  amount: number;
  currency: string;
  capturedAt: string;
  accountingBoundary: string;
  evidenceArtifactIds: string[];
}

export interface ComponentObservation {
  observationId: string;
  componentIdentity: ComponentIdentity;
  functionIds: string[];
  interfaceIds: string[];
  fixture: string;
  environment: Record<string, string>;
  executionClass?: ExecutionClass;
  metricResults: MetricResult[];
  runReceiptIds: string[];
  costObservation?: ComponentCostObservation;
  state:
    | "vendor_claimed"
    | "externally_reported"
    | "locally_observed"
    | "locally_qualified";
  limitations: string[];
  residuals: string[];
  sourceCaseId: string;
  sourceReleaseId: string;
  sourceReleaseDigest: string;
}

export interface ArchitecturePattern {
  patternId: string;
  name: string;
  problemShape: string;
  functionRoles: string[];
  interfaceRoles: string[];
  knownImplementationRefs: PrimitiveImplementationRef[];
  qualificationRefs: PrimitiveQualificationRef[];
  applicableConstraints: string[];
  failureModes: string[];
  residuals: string[];
  sourceCaseIds: string[];
  sourceReleaseIds: string[];
}

export interface CommonsAdmissionRequest {
  schemaVersion: 1;
  sourceCaseId: string;
  sourceReleaseId: string;
  sourceReleaseDigest: string;
  releaseVerificationState:
    | "current_valid"
    | "superseded_valid"
    | "withdrawn_valid";
  primitives: CapabilityPrimitive[];
  componentObservations: ComponentObservation[];
  architecturePatterns: ArchitecturePattern[];
}

export type CommonsFindingState =
  | "release_not_admissible"
  | "source_scope_mismatch"
  | "primitive_maturity_unearned"
  | "primitive_residual_missing"
  | "component_identity_incomplete"
  | "component_scope_incomplete"
  | "component_state_unearned"
  | "pattern_support_incomplete"
  | "duplicate_commons_identity";

export interface CommonsAdmissionFinding {
  state: CommonsFindingState;
  objectType: "primitive" | "component_observation" | "architecture_pattern" | "request";
  objectId: string;
  reason: string;
  requiredAction: string;
}

export interface CommonsAdmissionResult {
  passed: boolean;
  admittedPrimitiveIds: string[];
  admittedComponentObservationIds: string[];
  admittedArchitecturePatternIds: string[];
  blockedObjectIds: string[];
  findings: CommonsAdmissionFinding[];
}
