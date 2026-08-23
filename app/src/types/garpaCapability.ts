import type { GarpaAdmissionResult } from "./garpa";

export type FunctionClass =
  | "essential"
  | "enabling"
  | "coordination"
  | "sustainment"
  | "assurance"
  | "vendor_specific";

export type FunctionState = "required" | "optional" | "excluded" | "unresolved";

export type AutomationLevel =
  | "manual"
  | "decision_support"
  | "supervised_automation"
  | "bounded_autonomy";

export type ConsequenceClass = "routine" | "material" | "safety_critical";

export type InterfaceType =
  | "data"
  | "power"
  | "mechanical"
  | "network"
  | "human"
  | "environmental"
  | "organizational";

export interface CapabilityInterface {
  id: string;
  name: string;
  interfaceType: InterfaceType;
  formatOrProtocol?: string;
  rateOrCapacity?: string;
  latencyConstraint?: string;
  securityConstraint?: string;
  externalProducerDependencyIds: string[];
  externalConsumerDependencyIds: string[];
  terminal: boolean;
  evidenceCellIds: string[];
  limitations: string[];
}

export interface CapabilityFunction {
  id: string;
  name: string;
  purpose: string;
  functionClass: FunctionClass;
  state: FunctionState;
  inputInterfaceIds: string[];
  outputInterfaceIds: string[];
  functionDependencyIds: string[];
  externalDependencyIds: string[];
  automationLevel: AutomationLevel;
  humanRoleIds: string[];
  consequenceClass: ConsequenceClass;
  authorityBoundary?: string;
  evidenceCellIds: string[];
  assumptions: string[];
  failureModes: string[];
  residualQuestions: string[];
}

export interface HumanRole {
  id: string;
  title: string;
  responsibilities: string[];
  authorityBoundary?: string;
  staffingAssumption?: string;
  trainingRequirements: string[];
  evidenceCellIds: string[];
  limitations: string[];
}

export type ExternalDependencyType =
  | "sensor_or_input"
  | "service"
  | "infrastructure"
  | "communications"
  | "power"
  | "operator_organization"
  | "other";

export interface ExternalDependency {
  id: string;
  name: string;
  dependencyType: ExternalDependencyType;
  required: boolean;
  provider?: string;
  evidenceCellIds: string[];
  limitations: string[];
}

export type MissionTraceField =
  | "operator"
  | "protected_or_affected_object"
  | "problem_or_threat"
  | "desired_state_change"
  | "operating_environment"
  | "time_and_coverage_requirement"
  | "success_metric";

export interface RequirementTrace {
  id: string;
  missionField: MissionTraceField;
  metricId?: string;
  functionIds: string[];
  evidenceCellIds: string[];
  rationale: string;
}

export type ConstraintSectionState = "complete" | "partial" | "open";

export interface ConstraintSection {
  state: ConstraintSectionState;
  statements: string[];
  openQuestions: string[];
  evidenceCellIds: string[];
}

export interface ConstraintEnvelope {
  environment: ConstraintSection;
  deployment: ConstraintSection;
  resources: ConstraintSection;
  governance: ConstraintSection;
  economic: ConstraintSection;
}

export interface FeedbackLoop {
  id: string;
  name: string;
  functionIds: string[];
  interfaceIds: string[];
  rationale: string;
}

export interface CapabilityGraph {
  schemaVersion: 1;
  caseId: string;
  missionOutcomeDigest: string;
  functions: CapabilityFunction[];
  interfaces: CapabilityInterface[];
  traces: RequirementTrace[];
  humanRoles: HumanRole[];
  externalDependencies: ExternalDependency[];
  constraintEnvelope: ConstraintEnvelope;
  feedbackLoops: FeedbackLoop[];
  exclusions: string[];
  generatedAt: string;
}

export type CapabilityGraphGateState =
  | "admission_not_passed"
  | "mission_digest_mismatch"
  | "mission_trace_incomplete"
  | "essential_function_unresolved"
  | "interface_graph_incomplete"
  | "human_role_missing"
  | "constraint_envelope_incomplete"
  | "authorization_boundary_missing"
  | "vendor_architecture_leakage"
  | "admitted_for_substitution";

export interface CapabilityGraphGateResult {
  state: CapabilityGraphGateState;
  passed: boolean;
  admissionState: GarpaAdmissionResult["state"];
  uncoveredMissionFields: MissionTraceField[];
  uncoveredMetricIds: string[];
  orphanEssentialFunctionIds: string[];
  unresolvedFunctionIds: string[];
  danglingInterfaceIds: string[];
  unresolvedDependencyIds: string[];
  undeclaredDependencyCycles: string[];
  missingHumanRoleFunctionIds: string[];
  incompleteConstraintSections: Array<keyof ConstraintEnvelope>;
  missingAuthorityFunctionIds: string[];
  vendorLeakageFunctionIds: string[];
  pullList: string[];
}
