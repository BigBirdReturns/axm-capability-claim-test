import type {
  ArchitecturePattern,
  CapabilityPrimitive,
  ComponentObservation,
  ExecutionClass,
} from "./garpaCommons";
import type {
  CapabilityGraph,
  CapabilityGraphGateState,
} from "./garpaCapability";
import type {
  CommonsCatalog,
  CommonsCatalogObjectType,
  CommonsCatalogRevisionState,
  CommonsCatalogSearchHit,
  CommonsCatalogSearchQuery,
} from "./garpaCommonsCatalog";

export type CommonsTransferUse =
  | "capability_decomposition_hint"
  | "component_retrieval_lead"
  | "architecture_pattern_hint";

export type CommonsEnvironmentComparison =
  | "same"
  | "partial_overlap"
  | "different"
  | "unknown";

export type CommonsExecutionComparison =
  | "source_same_or_stronger"
  | "target_more_demanding"
  | "unknown";

export type CommonsNominationDisposition =
  | "candidate_input"
  | "research_lead";

export interface CapabilityGraphAdmissionReceipt {
  receiptId: string;
  capabilityGraphDigest: string;
  passed: boolean;
  state: CapabilityGraphGateState;
  receiptDigest: string;
}

export interface CommonsRetrievalTask {
  taskId: string;
  targetKind: "function" | "interface";
  targetId: string;
  targetLabel: string;
  searchTerms: string[];
  permittedObjectTypes: CommonsCatalogObjectType[];
  queries: CommonsCatalogSearchQuery[];
}

export interface CommonsRetrievalPlan {
  schemaVersion: 1;
  planId: string;
  catalogId: string;
  catalogDigest: string;
  caseId: string;
  capabilityGraphDigest: string;
  graphAdmissionReceiptId: string;
  tasks: CommonsRetrievalTask[];
  prohibitedTransitions: string[];
  planDigest: string;
}

export interface CommonsRetrievalPlanBuildRequest {
  catalog: CommonsCatalog;
  expectedCatalogDigest: string;
  targetCapabilityGraph: CapabilityGraph;
  targetCapabilityGraphDigest: string;
  targetGraphAdmissionReceipt: CapabilityGraphAdmissionReceipt;
}

export interface CommonsRetrievalPlanBuildResult {
  passed: boolean;
  errors: string[];
  plan?: CommonsRetrievalPlan;
}

export interface CommonsRetrievalCandidateHit {
  objectType: CommonsCatalogObjectType;
  catalogObjectId: string;
  revisionId: string;
  revisionNumber: number;
  revisionState: CommonsCatalogRevisionState;
  objectDigest: string;
  displayName: string;
  sourceCaseId: string;
  sourceReleaseId: string;
  sourceReleaseDigest: string;
  retrievalTaskIds: string[];
  targetFunctionIds: string[];
  targetInterfaceIds: string[];
  suggestedUse: CommonsTransferUse;
  hit: CommonsCatalogSearchHit;
}

export interface CommonsRetrievalExecutionResult {
  passed: boolean;
  errors: string[];
  planId: string;
  planDigest: string;
  catalogDigest: string;
  candidateHits: CommonsRetrievalCandidateHit[];
}

export interface CommonsTransferNomination {
  nominationId: string;
  objectType: CommonsCatalogObjectType;
  catalogObjectId: string;
  revisionId: string;
  objectDigest: string;
  retrievalTaskIds: string[];
  requestedUse: CommonsTransferUse;
  targetFunctionIds: string[];
  targetInterfaceIds: string[];
  mappingRationale: string;
  declaredEnvironmentComparison: CommonsEnvironmentComparison;
  declaredExecutionComparison: CommonsExecutionComparison;
  knownMismatches: string[];
  acknowledgedResiduals: string[];
  acknowledgedLimitations: string[];
  acknowledgedFalsificationConditions: string[];
  acknowledgedFailureModes: string[];
  requiredEvidencePulls: string[];
  requiredQualificationTests: string[];
}

export interface CommonsTransferRequest {
  schemaVersion: 1;
  catalog: CommonsCatalog;
  expectedCatalogDigest: string;
  targetCapabilityGraph: CapabilityGraph;
  targetCapabilityGraphDigest: string;
  targetGraphAdmissionReceipt: CapabilityGraphAdmissionReceipt;
  retrievalPlan: CommonsRetrievalPlan;
  targetEnvironment: Record<string, string>;
  targetExecutionClass?: ExecutionClass;
  allowHistoricalResearch: boolean;
  nominations: CommonsTransferNomination[];
  createdAt: string;
}

export type CommonsTransferFindingState =
  | "catalog_invalid"
  | "catalog_digest_mismatch"
  | "capability_graph_invalid"
  | "graph_digest_mismatch"
  | "graph_admission_receipt_invalid"
  | "graph_not_admitted"
  | "retrieval_plan_mismatch"
  | "catalog_revision_missing"
  | "object_digest_mismatch"
  | "historical_revision_not_permitted"
  | "withdrawn_revision"
  | "transfer_use_mismatch"
  | "retrieval_task_mismatch"
  | "target_function_invalid"
  | "target_interface_invalid"
  | "target_mapping_invalid"
  | "residual_acknowledgement_incomplete"
  | "limitation_acknowledgement_incomplete"
  | "falsification_acknowledgement_incomplete"
  | "failure_mode_acknowledgement_incomplete"
  | "environment_comparison_mismatch"
  | "execution_comparison_mismatch"
  | "transfer_scope_mismatch"
  | "requalification_plan_missing";

export interface CommonsTransferFinding {
  state: CommonsTransferFindingState;
  nominationId?: string;
  objectType?: CommonsCatalogObjectType;
  catalogObjectId?: string;
  reason: string;
  requiredAction: string;
}

export interface CommonsTransferredNomination {
  nominationId: string;
  disposition: CommonsNominationDisposition;
  requestedUse: CommonsTransferUse;
  targetFunctionIds: string[];
  targetInterfaceIds: string[];
  source: {
    objectType: CommonsCatalogObjectType;
    catalogObjectId: string;
    revisionId: string;
    revisionNumber: number;
    revisionState: CommonsCatalogRevisionState;
    objectDigest: string;
    sourceCaseId: string;
    sourceReleaseId: string;
    sourceReleaseDigest: string;
    executionClass?: ExecutionClass;
    environment?: Record<string, string>;
    residuals: string[];
    limitations: string[];
    falsificationConditions: string[];
    failureModes: string[];
    value: CapabilityPrimitive | ComponentObservation | ArchitecturePattern;
  };
  environmentComparison: CommonsEnvironmentComparison;
  executionComparison: CommonsExecutionComparison;
  knownMismatches: string[];
  requiredEvidencePulls: string[];
  requiredQualificationTests: string[];
}

export type CommonsTransferState =
  | "transfer_blocked"
  | "transfer_partially_admitted"
  | "transfer_admitted";

export interface CommonsTransferResult {
  passed: boolean;
  state: CommonsTransferState;
  admittedNominationIds: string[];
  candidateInputNominationIds: string[];
  researchLeadNominationIds: string[];
  blockedNominationIds: string[];
  findings: CommonsTransferFinding[];
  nominations: CommonsTransferredNomination[];
  pullList: string[];
  prohibitedTransitions: string[];
}
