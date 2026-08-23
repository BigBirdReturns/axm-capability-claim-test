import type { ExecutionClass } from "./garpaCommons";
import type { CommonsCatalog } from "./garpaCommonsCatalog";
import type {
  ComponentAvailabilityObservation,
  ComponentCandidate,
  ComponentKind,
  ComponentPriceObservation,
} from "./garpaSubstitution";

export interface CommonsCompatibilityAdmissionReceiptContent {
  receiptId: string;
  targetCaseId: string;
  targetMissionOutcomeDigest: string;
  targetCapabilityGraphDigest: string;
  nominationId: string;
  disposition: "compatibility_admitted";
  catalogObjectId: string;
  revisionId: string;
  objectDigest: string;
  sourceCaseId: string;
  sourceReleaseId: string;
  sourceReleaseDigest: string;
  targetFunctionIds: string[];
  targetInterfaceIds: string[];
  targetExecutionClass: ExecutionClass;
  targetIdentityReceiptIds: string[];
  targetCompatibilityReceiptIds: string[];
  targetEnvironmentReceiptIds: string[];
  targetQualificationReceiptIds: string[];
}

export interface CommonsCompatibilityAdmissionReceipt
  extends CommonsCompatibilityAdmissionReceiptContent {
  receiptDigest: string;
}

export interface TargetComponentEvidencePacket {
  targetCaseId: string;
  componentKind: ComponentKind;
  identityEvidenceCellIds: string[];
  performanceEvidenceCellIds: string[];
  licenseEvidenceCellIds: string[];
  operatingRequirementEvidenceCellIds: string[];
  securityEvidenceCellIds: string[];
  performanceEnvelope: Record<string, string>;
  operatingRequirements: Record<string, string>;
  license?: string;
  licenseNotApplicable?: boolean;
  sourceAvailability?: string;
  securityNotes: string[];
  price?: ComponentPriceObservation;
  availability?: ComponentAvailabilityObservation;
  integrationRequirements: string[];
  limitations: string[];
  residuals: string[];
}

export interface CommonsComponentProjectionRequest {
  schemaVersion: 1;
  projectionId: string;
  catalog: CommonsCatalog;
  expectedCatalogDigest: string;
  compatibilityAdmissionReceipt: CommonsCompatibilityAdmissionReceipt;
  targetComponentId: string;
  targetEvidence: TargetComponentEvidencePacket;
  economicBoundaryRequired: boolean;
  createdAt: string;
}

export type CommonsComponentProjectionReadiness =
  | "component_candidate"
  | "substitution_ready";

export type CommonsComponentProjectionFindingState =
  | "catalog_invalid"
  | "catalog_digest_mismatch"
  | "closure_receipt_invalid"
  | "closure_not_compatibility_admitted"
  | "source_object_missing"
  | "source_object_type_invalid"
  | "source_revision_missing"
  | "source_revision_not_current"
  | "source_coordinate_mismatch"
  | "target_case_mismatch"
  | "target_identity_evidence_missing"
  | "target_mapping_missing"
  | "target_evidence_incomplete";

export interface CommonsComponentProjectionFinding {
  state: CommonsComponentProjectionFindingState;
  reason: string;
  requiredAction: string;
}

export interface CommonsProjectionFieldProvenance {
  field: string;
  basis:
    | "exact_commons_revision"
    | "target_graph_mapping"
    | "target_case_evidence"
    | "derived_projection_policy"
    | "withheld";
  sourceCoordinates: string[];
  note: string;
}

export interface ProjectedCommonsComponentCandidate {
  projectionId: string;
  targetCaseId: string;
  sourceCatalogObjectId: string;
  sourceRevisionId: string;
  sourceObjectDigest: string;
  closureReceiptDigest: string;
  readiness: CommonsComponentProjectionReadiness;
  component: ComponentCandidate;
  fieldProvenance: CommonsProjectionFieldProvenance[];
  withheldFields: string[];
  requiredEvidencePulls: string[];
  prohibitedTransitions: string[];
}

export interface CommonsComponentProjectionResult {
  passed: boolean;
  state:
    | CommonsComponentProjectionFindingState
    | "component_projection_admitted";
  readiness?: CommonsComponentProjectionReadiness;
  findings: CommonsComponentProjectionFinding[];
  projected?: ProjectedCommonsComponentCandidate;
}
