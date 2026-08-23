import type { BuildManifest, BuildManifestGateResult } from "./garpaBuild";
import type {
  CommonsSeededQualificationRequest,
  CommonsSeededQualificationResult,
} from "./garpaCommonsSeededQualification";

export interface CommonsSeededBuildManifestBinding {
  bindingId: string;
  componentId: string;
  sourceCatalogObjectId: string;
  sourceRevisionId: string;
  sourceObjectDigest: string;
  qualificationBindingId: string;
  architectureSelectionDigest: string;
  architectureConfigurationDigest: string;
  buildComponentDigest: string;
  substitutionPolicyDigest: string;
  requiredCalibrationItemIds: string[];
  requiredAssemblyStepIds: string[];
}

export interface CommonsSeededBuildManifestRequest {
  schemaVersion: 1;
  seededQualificationRequest: CommonsSeededQualificationRequest;
  expectedSeededQualificationResultDigest: string;
  buildManifest: BuildManifest;
  seededComponentBindings: CommonsSeededBuildManifestBinding[];
  frozenAt: string;
}

export type CommonsSeededBuildManifestFindingState =
  | "seeded_qualification_result_mismatch"
  | "seeded_qualification_not_admitted"
  | "build_manifest_case_mismatch"
  | "candidate_architecture_digest_mismatch"
  | "qualification_contract_digest_mismatch"
  | "build_manifest_digest_mismatch"
  | "build_manifest_freeze_time_mismatch"
  | "seeded_component_binding_missing"
  | "seeded_component_binding_unexpected"
  | "seeded_source_mismatch"
  | "qualification_binding_mismatch"
  | "architecture_selection_digest_mismatch"
  | "architecture_configuration_digest_mismatch"
  | "build_component_digest_mismatch"
  | "seeded_component_identity_mismatch"
  | "seeded_component_configuration_mismatch"
  | "seeded_component_mapping_mismatch"
  | "seeded_substitution_policy_mismatch"
  | "seeded_calibration_custody_mismatch"
  | "seeded_assembly_custody_mismatch"
  | "build_manifest_validation_failed";

export interface CommonsSeededBuildManifestFinding {
  state: CommonsSeededBuildManifestFindingState;
  bindingId?: string;
  componentId?: string;
  reason: string;
  requiredAction: string;
}

export type CommonsSeededBuildManifestState =
  | "seeded_build_manifest_blocked"
  | "seeded_build_manifest_incomplete"
  | "seeded_build_manifest_admitted";

export interface CommonsSeededBuildManifestResult {
  passed: boolean;
  state: CommonsSeededBuildManifestState;
  seededQualificationResult?: CommonsSeededQualificationResult;
  seededQualificationResultDigest: string;
  candidateArchitectureDigest: string;
  qualificationContractDigest: string;
  buildManifestDigest: string;
  seededComponentIds: string[];
  boundSeededComponentIds: string[];
  findings: CommonsSeededBuildManifestFinding[];
  buildManifestValidationErrors: string[];
  buildManifestGate?: BuildManifestGateResult;
  buildManifest?: BuildManifest;
  pullList: string[];
  prohibitedTransitions: string[];
}
