export type ComponentKind =
  | "commercial_hardware"
  | "open_hardware"
  | "software_package"
  | "open_source_project"
  | "service"
  | "human_role"
  | "custom_code"
  | "custom_fabrication"
  | "test_equipment"
  | "external_dependency";

export type ComponentMaturity =
  | "vendor_claimed"
  | "community_reported"
  | "independently_reported"
  | "bench_reproduced"
  | "field_reproduced"
  | "locally_qualified";

export type ComponentLifecycle =
  | "available"
  | "limited"
  | "end_of_life"
  | "unverified"
  | "superseded";

export type AvailabilityState =
  | "in_stock"
  | "limited"
  | "lead_time"
  | "unavailable"
  | "unknown";

export interface ComponentPriceObservation {
  amount: number;
  currency: string;
  capturedAt: string;
  evidenceCellIds: string[];
  includedCostCategories: string[];
  excludedCostCategories: string[];
}

export interface ComponentAvailabilityObservation {
  state: AvailabilityState;
  capturedAt: string;
  evidenceCellIds: string[];
  note?: string;
}

export interface ComponentCandidate {
  id: string;
  kind: ComponentKind;
  manufacturer?: string;
  product: string;
  exactModelOrVersion: string;
  functionIds: string[];
  interfaceIds: string[];
  maturity: ComponentMaturity;
  identityEvidenceCellIds: string[];
  performanceEvidenceCellIds: string[];
  licenseEvidenceCellIds: string[];
  performanceEnvelope: Record<string, string>;
  operatingRequirements: Record<string, string>;
  license?: string;
  sourceAvailability?: string;
  securityNotes: string[];
  price?: ComponentPriceObservation;
  availability?: ComponentAvailabilityObservation;
  integrationRequirements: string[];
  limitations: string[];
  residuals: string[];
  lifecycle: ComponentLifecycle;
}

export type CustomCodeComplexity =
  | "small"
  | "bounded"
  | "substantial"
  | "research_grade"
  | "unresolved";

export interface SubstitutionCustomCode {
  id: string;
  version: string;
  functionIds: string[];
  interfaceIds: string[];
  purpose: string;
  inputs: string[];
  outputs: string[];
  complexity: CustomCodeComplexity;
  dependencies: string[];
  testStrategy: string[];
  safetyProperties: string[];
  securityProperties: string[];
  residuals: string[];
}

export type CompatibilityState =
  | "confirmed_compatible"
  | "reported_compatible"
  | "adapter_required"
  | "experimental"
  | "incompatible"
  | "unknown";

export interface ComponentCompatibilityEdge {
  id: string;
  interfaceId: string;
  producerComponentIds: string[];
  consumerComponentIds: string[];
  state: CompatibilityState;
  adapterComponentIds: string[];
  customCodeIds: string[];
  evidenceCellIds: string[];
  limitations: string[];
  falsificationTest: string;
}

export type SubstitutionCoverage =
  | "complete_candidate"
  | "partial_candidate"
  | "experimental"
  | "uncovered";

export type SubstitutionMaturity =
  | "established"
  | "reported"
  | "experimental"
  | "unknown";

export interface SubstitutionOption {
  id: string;
  functionId: string;
  componentIds: string[];
  customCodeIds: string[];
  coverage: SubstitutionCoverage;
  maturity: SubstitutionMaturity;
  composition: string;
  integrationWork: string[];
  evidenceCellIds: string[];
  residuals: string[];
  falsificationTest: string;
}

export interface SubstitutionCostBoundary {
  state: "complete" | "partial" | "unresolved";
  currency?: string;
  evaluationPeriod?: string;
  includedCategories: string[];
  excludedCategories: string[];
  note?: string;
}

export interface SubstitutionPlan {
  schemaVersion: 1;
  caseId: string;
  capabilityGraphDigest: string;
  components: ComponentCandidate[];
  customCode: SubstitutionCustomCode[];
  compatibilityEdges: ComponentCompatibilityEdge[];
  options: SubstitutionOption[];
  costBoundary: SubstitutionCostBoundary;
  exclusions: string[];
}

export type SubstitutionGateState =
  | "capability_graph_not_admitted"
  | "graph_digest_mismatch"
  | "component_identity_incomplete"
  | "component_evidence_insufficient"
  | "function_coverage_incomplete"
  | "interface_coverage_incomplete"
  | "custom_code_unbounded"
  | "residual_or_test_missing"
  | "cost_boundary_incomplete"
  | "admitted_for_architecture";

export interface SubstitutionGateResult {
  state: SubstitutionGateState;
  passed: boolean;
  invalidComponentIds: string[];
  weakEvidenceComponentIds: string[];
  unavailableComponentIds: string[];
  uncoveredFunctionIds: string[];
  uncoveredInterfaceIds: string[];
  incompatibleInterfaceIds: string[];
  unboundedCustomCodeIds: string[];
  incompleteOptionIds: string[];
  costBoundaryFindings: string[];
  pullList: string[];
}
