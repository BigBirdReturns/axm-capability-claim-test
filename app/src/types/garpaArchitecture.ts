export type ArchitectureState =
  | "concept"
  | "candidate"
  | "integration_ready"
  | "superseded";

export interface ArchitectureComponentSelection {
  componentId: string;
  quantity: number;
  optionIds: string[];
  functionIds: string[];
  interfaceIds: string[];
  role: string;
  configurationState: "defined" | "unresolved";
  configuration: Record<string, string>;
}

export interface ArchitectureCustomCodeSelection {
  customCodeId: string;
  optionIds: string[];
  functionIds: string[];
  interfaceIds: string[];
  configurationState: "defined" | "unresolved";
  configuration: Record<string, string>;
}

export interface ArchitectureCompatibilitySelection {
  compatibilityEdgeId: string;
  interfaceId: string;
  producerComponentIds: string[];
  consumerComponentIds: string[];
  adapterComponentIds: string[];
  customCodeIds: string[];
}

export interface ArchitectureHumanRoleSelection {
  humanRoleId: string;
  staffing: string;
  responsibilities: string[];
  authorityBoundary?: string;
}

export interface ArchitectureDependencySelection {
  dependencyId: string;
  providerOrSource: string;
  availabilityAssumption: string;
  fallback?: string;
}

export type ArchitectureCostCategory =
  | "hardware"
  | "software"
  | "services"
  | "custom_code"
  | "fabrication"
  | "integration_labor"
  | "operator_labor"
  | "training"
  | "test_equipment"
  | "qualification"
  | "maintenance"
  | "spares"
  | "communications"
  | "facilities"
  | "energy"
  | "regulatory"
  | "contingency";

export interface ArchitectureCostLine {
  id: string;
  category: ArchitectureCostCategory;
  description: string;
  low: number;
  expected: number;
  high: number;
  currency: string;
  recurrence: "one_time" | "monthly" | "annual" | "per_operation" | "per_unit";
  quantity: number;
  basis: string;
  evidenceCellIds: string[];
  confidence: "high" | "medium" | "low" | "open";
}

export interface ArchitectureCostEnvelope {
  currency: string;
  evaluationPeriod: string;
  lines: ArchitectureCostLine[];
  exclusions: string[];
}

export interface ArchitectureScheduleLine {
  id: string;
  phase: "procurement" | "assembly" | "integration" | "qualification" | "other";
  description: string;
  predecessorIds: string[];
  lowDays: number;
  expectedDays: number;
  highDays: number;
  owner: string;
  acceptanceCondition: string;
}

export interface ArchitectureScheduleEnvelope {
  lines: ArchitectureScheduleLine[];
  assumptions: string[];
}

export type ArchitectureRiskCategory =
  | "performance"
  | "integration"
  | "availability"
  | "security"
  | "safety"
  | "regulatory"
  | "sustainment"
  | "cost"
  | "schedule"
  | "operator_burden"
  | "evidence";

export type ArchitectureRiskConsequence =
  | "minor"
  | "material"
  | "mission_failure"
  | "unsafe"
  | "unknown";

export interface ArchitectureRisk {
  id: string;
  category: ArchitectureRiskCategory;
  statement: string;
  probability: "low" | "medium" | "high" | "unknown";
  consequence: ArchitectureRiskConsequence;
  affectedFunctionIds: string[];
  affectedComponentIds: string[];
  mitigation: string[];
  qualificationTestIds: string[];
  evidenceCellIds: string[];
  closureState:
    | "open"
    | "mitigated_by_design"
    | "requires_test"
    | "accepted"
    | "closed";
}

export interface ArchitectureResidual {
  id: string;
  statement: string;
  sourceOptionIds: string[];
  sourceComponentIds: string[];
  affectedFunctionIds: string[];
  disposition:
    | "qualify"
    | "accept"
    | "redesign"
    | "exclude"
    | "unresolved";
  qualificationTestIds: string[];
}

export interface CandidateArchitecture {
  schemaVersion: 1;
  caseId: string;
  missionOutcomeDigest: string;
  capabilityGraphDigest: string;
  substitutionPlanDigest: string;
  selectedOptionIds: string[];
  componentSelections: ArchitectureComponentSelection[];
  customCodeSelections: ArchitectureCustomCodeSelection[];
  compatibilitySelections: ArchitectureCompatibilitySelection[];
  humanRoleSelections: ArchitectureHumanRoleSelection[];
  dependencySelections: ArchitectureDependencySelection[];
  costEnvelope: ArchitectureCostEnvelope;
  scheduleEnvelope: ArchitectureScheduleEnvelope;
  risks: ArchitectureRisk[];
  residuals: ArchitectureResidual[];
  assumptions: string[];
  exclusions: string[];
  state: ArchitectureState;
}

export type ArchitectureGateState =
  | "substitution_not_admitted"
  | "upstream_digest_mismatch"
  | "option_selection_incomplete"
  | "component_selection_incomplete"
  | "compatibility_selection_incomplete"
  | "custom_code_selection_incomplete"
  | "human_role_unresolved"
  | "external_dependency_unresolved"
  | "cost_envelope_incomplete"
  | "schedule_envelope_incomplete"
  | "high_consequence_risk_uncontrolled"
  | "residual_register_incomplete"
  | "state_transition_invalid"
  | "admitted_for_qualification";

export interface ArchitectureGateResult {
  state: ArchitectureGateState;
  passed: boolean;
  missingOptionIds: string[];
  missingComponentIds: string[];
  unresolvedConfigurationIds: string[];
  missingCompatibilityEdgeIds: string[];
  missingCustomCodeIds: string[];
  missingHumanRoleIds: string[];
  missingDependencyIds: string[];
  costFindings: string[];
  scheduleFindings: string[];
  uncontrolledRiskIds: string[];
  uncoveredResidualOptionIds: string[];
  uncoveredResidualComponentIds: string[];
  pullList: string[];
}
