import type {
  CommonsSeededBuildManifestRequest,
  CommonsSeededBuildManifestResult,
} from "./garpaCommonsSeededBuildManifest";

export interface AsBuiltArtifactRef {
  artifactId: string;
  sha256: string;
  mediaType: string;
  path: string;
  capturedAt: string;
}

export interface InstalledComponentReceipt {
  componentId: string;
  bindingId?: string;
  exactModelOrVersion: string;
  quantity: number;
  serialOrLotIds: string[];
  firmwareOrRuntimeVersion?: string;
  configurationDigest: string;
  supplierOrSource: string;
  actualUnitCost: number;
  currency: string;
  acquisitionRecordIds: string[];
  installedAt: string;
  installedBy: string;
  evidenceArtifactIds: string[];
}

export interface InstalledCustomCodeReceipt {
  customCodeId: string;
  exactVersion: string;
  sourceCommit: string;
  packageDigest: string;
  dependencyLockDigest: string;
  configurationDigest: string;
  installedAt: string;
  installedBy: string;
  evidenceArtifactIds: string[];
}

export interface CalibrationExecutionReceipt {
  calibrationPlanId: string;
  subjectId: string;
  state: "passed" | "failed" | "inconclusive";
  executedAt: string;
  executedBy: string;
  evidenceArtifactIds: string[];
  notes: string[];
}

export interface AssemblyStepExecutionReceipt {
  assemblyStepId: string;
  state: "passed" | "failed" | "skipped";
  startedAt: string;
  completedAt: string;
  executedBy: string;
  componentIds: string[];
  customCodeIds: string[];
  compatibilityEdgeIds: string[];
  evidenceArtifactIds: string[];
  deviationIds: string[];
  rollbackPerformed: boolean;
  notes: string[];
}

export interface ExecutedSubstitutionReceipt {
  substitutionId: string;
  originalComponentId: string;
  replacementComponentId: string;
  policy: "equivalent_with_retest" | "architecture_review";
  approvalReceiptIds: string[];
  regressionMetricIds: string[];
  evidenceArtifactIds: string[];
  executedAt: string;
}

export interface BuildDeviationReceipt {
  deviationId: string;
  description: string;
  affectedComponentIds: string[];
  affectedCustomCodeIds: string[];
  affectedCompatibilityEdgeIds: string[];
  disposition: "accepted" | "reworked" | "blocked";
  approvalReceiptIds: string[];
  evidenceArtifactIds: string[];
}

export interface ActualCostReceipt {
  costLineId: string;
  amount: number;
  currency: string;
  evidenceArtifactIds: string[];
}

export interface ActualLaborReceipt {
  laborId: string;
  category:
    | "procurement"
    | "assembly"
    | "configuration"
    | "integration"
    | "debugging"
    | "calibration"
    | "qualification_preparation"
    | "documentation"
    | "other";
  actor: string;
  hours: number;
  evidenceArtifactIds: string[];
}

export interface CommonsSeededAsBuiltReceipt {
  schemaVersion: 1;
  receiptId: string;
  caseId: string;
  seededBuildManifestResultDigest: string;
  buildManifestDigest: string;
  candidateArchitectureDigest: string;
  qualificationContractDigest: string;
  installedComponents: InstalledComponentReceipt[];
  installedCustomCode: InstalledCustomCodeReceipt[];
  calibrationReceipts: CalibrationExecutionReceipt[];
  assemblyStepReceipts: AssemblyStepExecutionReceipt[];
  substitutions: ExecutedSubstitutionReceipt[];
  deviations: BuildDeviationReceipt[];
  actualCosts: ActualCostReceipt[];
  labor: ActualLaborReceipt[];
  artifacts: AsBuiltArtifactRef[];
  startedAt: string;
  completedAt: string;
  state: "assembled" | "blocked" | "superseded";
  qualificationTransferred: false;
  missionEquivalenceClaimed: false;
  receiptDigest: string;
}

export interface CommonsSeededBuildReceiptRequest {
  schemaVersion: 1;
  seededBuildManifestRequest: CommonsSeededBuildManifestRequest;
  expectedSeededBuildManifestResultDigest: string;
  asBuiltReceipt: CommonsSeededAsBuiltReceipt;
  admittedAt: string;
}

export type CommonsSeededBuildReceiptFindingState =
  | "seeded_build_manifest_result_mismatch"
  | "seeded_build_manifest_not_admitted"
  | "as_built_receipt_digest_mismatch"
  | "as_built_case_mismatch"
  | "as_built_upstream_digest_mismatch"
  | "as_built_time_order_invalid"
  | "installed_component_missing"
  | "installed_component_unexpected"
  | "installed_component_identity_mismatch"
  | "installed_component_quantity_mismatch"
  | "installed_component_configuration_mismatch"
  | "installed_component_firmware_mismatch"
  | "installed_component_serial_custody_missing"
  | "installed_component_evidence_missing"
  | "installed_custom_code_missing"
  | "installed_custom_code_mismatch"
  | "calibration_receipt_missing"
  | "calibration_receipt_failed"
  | "assembly_step_receipt_missing"
  | "assembly_step_receipt_failed"
  | "assembly_step_scope_mismatch"
  | "seeded_component_substitution_forbidden"
  | "substitution_policy_mismatch"
  | "deviation_unresolved"
  | "actual_cost_trace_incomplete"
  | "actual_cost_evidence_missing"
  | "labor_evidence_missing"
  | "artifact_custody_missing"
  | "receipt_state_not_assembled"
  | "qualification_transfer_attempted"
  | "mission_equivalence_attempted"
  | "as_built_validation_failed";

export interface CommonsSeededBuildReceiptFinding {
  state: CommonsSeededBuildReceiptFindingState;
  componentId?: string;
  customCodeId?: string;
  assemblyStepId?: string;
  calibrationPlanId?: string;
  reason: string;
  requiredAction: string;
}

export type CommonsSeededBuildReceiptState =
  | "seeded_build_receipt_blocked"
  | "seeded_build_receipt_incomplete"
  | "seeded_build_receipt_admitted";

export interface CommonsSeededBuildReceiptResult {
  passed: boolean;
  state: CommonsSeededBuildReceiptState;
  seededBuildManifestResult?: CommonsSeededBuildManifestResult;
  seededBuildManifestResultDigest: string;
  asBuiltReceiptDigest: string;
  buildManifestDigest: string;
  installedComponentIds: string[];
  receiptedAssemblyStepIds: string[];
  receiptedCalibrationPlanIds: string[];
  substitutedComponentIds: string[];
  findings: CommonsSeededBuildReceiptFinding[];
  validationErrors: string[];
  asBuiltReceipt?: CommonsSeededAsBuiltReceipt;
  pullList: string[];
  prohibitedTransitions: string[];
}
