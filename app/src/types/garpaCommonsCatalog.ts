import type {
  ArchitecturePattern,
  CapabilityPrimitive,
  CommonsAdmissionRequest,
  CommonsAdmissionResult,
  ComponentObservation,
  ExecutionClass,
  PrimitiveMaturity,
} from "./garpaCommons";

export type CommonsCatalogObjectType =
  | "primitive"
  | "component_observation"
  | "architecture_pattern";

export type CommonsCatalogRevisionState =
  | "current"
  | "superseded"
  | "withdrawn";

export interface CommonsCatalogRevision<T> {
  revisionId: string;
  revisionNumber: number;
  objectDigest: string;
  state: CommonsCatalogRevisionState;
  supersedesRevisionId?: string;
  sourceCaseId: string;
  sourceReleaseId: string;
  sourceReleaseDigest: string;
  catalogedAt: string;
  value: T;
}

export interface CommonsCatalogEntry<T> {
  catalogObjectId: string;
  objectType: CommonsCatalogObjectType;
  identityKey: string;
  aliases: string[];
  revisions: CommonsCatalogRevision<T>[];
  currentRevisionId?: string;
}

export interface CommonsCatalog {
  schemaVersion: 1;
  catalogId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  primitiveEntries: CommonsCatalogEntry<CapabilityPrimitive>[];
  componentObservationEntries: CommonsCatalogEntry<ComponentObservation>[];
  architecturePatternEntries: CommonsCatalogEntry<ArchitecturePattern>[];
  catalogDigest: string;
}

export type CommonsCatalogOperationAction =
  | "create"
  | "supersede"
  | "noop";

export interface CommonsCatalogOperation {
  operationId: string;
  objectType: CommonsCatalogObjectType;
  incomingObjectId: string;
  action: CommonsCatalogOperationAction;
  catalogObjectId: string;
  expectedCurrentRevisionId?: string;
  aliasesAdded: string[];
  reason: string;
}

export interface CommonsCatalogUpdateRequest {
  schemaVersion: 1;
  currentCatalog: CommonsCatalog;
  expectedCatalogDigest: string;
  admissionRequest: CommonsAdmissionRequest;
  admissionResult: CommonsAdmissionResult;
  operations: CommonsCatalogOperation[];
  actor: string;
  updatedAt: string;
}

export type CommonsCatalogFindingState =
  | "catalog_digest_mismatch"
  | "catalog_history_invalid"
  | "admission_result_mismatch"
  | "operation_coverage_incomplete"
  | "blocked_object_targeted"
  | "operation_target_conflict"
  | "catalog_identity_conflict"
  | "catalog_object_missing"
  | "current_revision_conflict"
  | "invalid_supersession"
  | "invalid_noop"
  | "timestamp_regression";

export interface CommonsCatalogFinding {
  state: CommonsCatalogFindingState;
  operationId?: string;
  objectType?: CommonsCatalogObjectType;
  incomingObjectId?: string;
  catalogObjectId?: string;
  reason: string;
  requiredAction: string;
}

export type CommonsCatalogUpdateState =
  | CommonsCatalogFindingState
  | "catalog_noop"
  | "catalog_update_admitted";

export interface CommonsCatalogUpdateGateResult {
  passed: boolean;
  state: CommonsCatalogUpdateState;
  findings: CommonsCatalogFinding[];
  admittedOperationIds: string[];
  noopOperationIds: string[];
}

export interface CommonsCatalogUpdateReceipt {
  receiptId: string;
  catalogId: string;
  priorCatalogRevision: number;
  resultingCatalogRevision: number;
  priorCatalogDigest: string;
  resultingCatalogDigest: string;
  sourceCaseId: string;
  sourceReleaseId: string;
  sourceReleaseDigest: string;
  actor: string;
  updatedAt: string;
  appliedOperationIds: string[];
  noopOperationIds: string[];
}

export interface CommonsCatalogUpdateResult {
  gate: CommonsCatalogUpdateGateResult;
  catalog?: CommonsCatalog;
  receipt?: CommonsCatalogUpdateReceipt;
  appliedOperationIds: string[];
  noopOperationIds: string[];
}

export interface CommonsCatalogSearchQuery {
  text?: string;
  objectTypes?: CommonsCatalogObjectType[];
  sourceCaseIds?: string[];
  sourceReleaseIds?: string[];
  functionIds?: string[];
  interfaceIds?: string[];
  executionClasses?: ExecutionClass[];
  primitiveMaturities?: PrimitiveMaturity[];
  componentStates?: ComponentObservation["state"][];
  includeSuperseded?: boolean;
  includeWithdrawn?: boolean;
  limit?: number;
}

export interface CommonsCatalogSearchHit {
  objectType: CommonsCatalogObjectType;
  catalogObjectId: string;
  revisionId: string;
  revisionNumber: number;
  revisionState: CommonsCatalogRevisionState;
  identityKey: string;
  displayName: string;
  matchedFields: string[];
  sourceCaseId: string;
  sourceReleaseId: string;
  sourceReleaseDigest: string;
  executionClass?: ExecutionClass;
  maturityOrState?: string;
  fixture?: string;
  environment?: Record<string, string>;
  residuals: string[];
  falsificationConditions: string[];
  value: CapabilityPrimitive | ComponentObservation | ArchitecturePattern;
}

export interface CommonsCatalogSearchResult {
  catalogId: string;
  catalogDigest: string;
  query: CommonsCatalogSearchQuery;
  totalMatches: number;
  truncated: boolean;
  hits: CommonsCatalogSearchHit[];
}
