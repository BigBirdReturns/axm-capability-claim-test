export interface BuildManifestComponent {
  componentId: string;
  kind:
    | "hardware"
    | "software"
    | "service"
    | "fabricated_item"
    | "test_equipment"
    | "other";
  exactModelOrVersion: string;
  quantity: number;
  supplierOrSource: string;
  acquisitionState: "existing" | "to_acquire" | "reserved";
  unitCost: number;
  currency: string;
  configurationDigest: string;
  firmwareOrRuntimeVersion?: string;
  license?: string;
  serialOrLotPolicy: "record_each" | "not_applicable";
  functionIds: string[];
  interfaceIds: string[];
  calibrationRequired: boolean;
}

export interface BuildManifestCustomCode {
  customCodeId: string;
  exactVersion: string;
  sourceCommit: string;
  packageDigest: string;
  dependencyLockDigest: string;
  configurationDigest: string;
  buildAndInstallProcedure: string[];
  functionIds: string[];
  interfaceIds: string[];
}

export interface BuildManifestCompatibilityEdge {
  compatibilityEdgeId: string;
  interfaceId: string;
  producerComponentIds: string[];
  consumerComponentIds: string[];
  adapterComponentIds: string[];
  customCodeIds: string[];
  acceptanceTestIds: string[];
}

export interface BuildManifestHumanRole {
  humanRoleId: string;
  staffing: string;
  requiredTraining: string[];
  responsibilities: string[];
  authorityBoundary?: string;
}

export interface BuildManifestDependency {
  dependencyId: string;
  providerOrSource: string;
  exactServiceOrDatasetVersion: string;
  availabilityCheck: string;
  fallback?: string;
}

export interface BuildManifestInstrumentation {
  instrumentationId: string;
  exactModelOrVersion: string;
  configurationDigest: string;
  calibrationState: "current" | "not_required";
  calibrationEvidenceIds: string[];
  storagePath: string;
}

export interface BuildManifestCalibrationItem {
  id: string;
  subjectId: string;
  method: string;
  acceptanceCondition: string;
  evidenceArtifactPattern: string;
  owner: string;
}

export interface BuildManifestSubstitutionPolicy {
  componentId: string;
  policy: "no_substitution" | "equivalent_with_retest" | "architecture_review";
  equivalenceCriteria: string[];
  requiredRegressionTestIds: string[];
  prohibitedSubstitutions: string[];
}

export interface BuildManifestAssemblyStep {
  id: string;
  predecessorIds: string[];
  componentIds: string[];
  customCodeIds: string[];
  compatibilityEdgeIds: string[];
  procedure: string[];
  acceptanceCondition: string;
  rollbackProcedure: string[];
  owner: string;
}

export interface BuildManifest {
  schemaVersion: 1;
  caseId: string;
  candidateArchitectureDigest: string;
  qualificationContractDigest: string;
  components: BuildManifestComponent[];
  customCode: BuildManifestCustomCode[];
  compatibilityEdges: BuildManifestCompatibilityEdge[];
  humanRoles: BuildManifestHumanRole[];
  dependencies: BuildManifestDependency[];
  instrumentation: BuildManifestInstrumentation[];
  calibrationPlan: BuildManifestCalibrationItem[];
  substitutionPolicies: BuildManifestSubstitutionPolicy[];
  assemblySteps: BuildManifestAssemblyStep[];
  expectedCostLineIds: string[];
  expectedScheduleLineIds: string[];
  manifestDigest: string;
  frozenAt: string;
  state: "candidate" | "frozen" | "superseded";
}

export type BuildManifestGateState =
  | "qualification_not_admitted"
  | "upstream_digest_mismatch"
  | "component_manifest_incomplete"
  | "custom_code_manifest_incomplete"
  | "compatibility_manifest_incomplete"
  | "human_role_manifest_incomplete"
  | "dependency_manifest_incomplete"
  | "instrumentation_manifest_incomplete"
  | "calibration_plan_incomplete"
  | "substitution_policy_incomplete"
  | "assembly_plan_incomplete"
  | "cost_or_schedule_trace_incomplete"
  | "manifest_not_frozen"
  | "admitted_for_assembly";

export interface BuildManifestGateResult {
  state: BuildManifestGateState;
  passed: boolean;
  missingComponentIds: string[];
  componentFindings: string[];
  missingCustomCodeIds: string[];
  customCodeFindings: string[];
  missingCompatibilityEdgeIds: string[];
  missingHumanRoleIds: string[];
  missingDependencyIds: string[];
  missingInstrumentationIds: string[];
  calibrationFindings: string[];
  missingSubstitutionPolicyIds: string[];
  assemblyFindings: string[];
  missingCostLineIds: string[];
  missingScheduleLineIds: string[];
  pullList: string[];
}
