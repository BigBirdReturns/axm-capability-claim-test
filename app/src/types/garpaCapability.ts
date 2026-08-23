export type CapabilityFunctionClass =
  | "essential"
  | "enabling"
  | "coordination"
  | "sustainment"
  | "assurance"
  | "vendor_specific";

export type CapabilityFunctionState =
  | "required"
  | "optional"
  | "excluded"
  | "unresolved";

export type CapabilityFunctionOrigin =
  | "mission_derived"
  | "evidence_derived"
  | "vendor_specific";

export type AutomationLevel =
  | "manual"
  | "decision_support"
  | "supervised_automation"
  | "bounded_autonomy"
  | "unresolved";

export type CapabilityInterfaceType =
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
  interfaceType: CapabilityInterfaceType;
  producerFunctionIds: string[];
  consumerFunctionIds: string[];
  externalSource?: string;
  terminalPurpose?: string;
  formatOrProtocol?: string;
  rateOrCapacity?: string;
  latencyConstraint?: string;
  securityConstraint?: string;
  evidenceCellIds: string[];
  limitations: string[];
}

export interface CapabilityFunction {
  id: string;
  name: string;
  purpose: string;
  functionClass: CapabilityFunctionClass;
  state: CapabilityFunctionState;
  origin: CapabilityFunctionOrigin;
  inputInterfaceIds: string[];
  outputInterfaceIds: string[];
  requirementKeys: string[];
  metricIds: string[];
  dependencyFunctionIds: string[];
  humanRoleIds: string[];
  automationLevel: AutomationLevel;
  requiresAuthorizationBoundary: boolean;
  authorizationBoundary?: string;
  operatingConstraints: string[];
  failureModes: string[];
  evidenceCellIds: string[];
  assumptions: string[];
  residualQuestions: string[];
}

export interface CapabilityRequirementTrace {
  requirementKey: string;
  functionIds: string[];
  metricIds: string[];
  evidenceCellIds: string[];
}

export interface CapabilityHumanRole {
  id: string;
  title: string;
  functionIds: string[];
  responsibilities: string[];
  authorityBoundary?: string;
  training?: string[];
  staffingAssumption?: string;
  evidenceCellIds: string[];
}

export interface CapabilityExternalDependency {
  id: string;
  name: string;
  dependencyType:
    | "infrastructure"
    | "service"
    | "data_source"
    | "supplier"
    | "authority"
    | "other";
  requiredByFunctionIds: string[];
  evidenceCellIds: string[];
  limitations: string[];
}

export type ConstraintSetState =
  | "defined"
  | "not_applicable"
  | "unresolved";

export interface CapabilityConstraintSet {
  state: ConstraintSetState;
  items: string[];
  note?: string;
}

export interface CapabilityConstraintEnvelope {
  environment: CapabilityConstraintSet;
  deployment: CapabilityConstraintSet;
  resources: CapabilityConstraintSet;
  governance: CapabilityConstraintSet;
  economic: CapabilityConstraintSet;
}

export interface CapabilityGraph {
  schemaVersion: 1;
  caseId: string;
  missionOutcomeDigest: string;
  functions: CapabilityFunction[];
  interfaces: CapabilityInterface[];
  traces: CapabilityRequirementTrace[];
  humanRoles: CapabilityHumanRole[];
  externalDependencies: CapabilityExternalDependency[];
  constraintEnvelope: CapabilityConstraintEnvelope;
  exclusions: string[];
}

export type CapabilityGraphGateState =
  | "goal_not_admitted"
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
  requiredRequirementKeys: string[];
  uncoveredRequirementKeys: string[];
  unresolvedEssentialFunctionIds: string[];
  orphanEssentialFunctionIds: string[];
  danglingInterfaceIds: string[];
  interfaceMismatchFindings: string[];
  missingHumanRoleFunctionIds: string[];
  incompleteConstraintSets: string[];
  missingAuthorizationFunctionIds: string[];
  vendorLeakageFunctionIds: string[];
  pullList: string[];
}
