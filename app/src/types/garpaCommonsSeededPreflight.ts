import type {
  CommonsSeededBuildReceiptRequest,
  CommonsSeededBuildReceiptResult,
} from "./garpaCommonsSeededBuildReceipt";
import type { PreflightGateResult } from "./garpaExecution";

export interface PreflightEvidenceRef {
  evidenceId: string;
  sha256: string;
  path: string;
  capturedAt: string;
}

export interface PreflightFixtureCheck {
  fixtureId: string;
  configurationDigest: string;
  state: "ready" | "blocked" | "unknown";
  verifiedAt: string;
  verifiedBy: string;
  evidenceIds: string[];
}

export interface PreflightInstrumentationCheck {
  instrumentationId: string;
  exactModelOrVersion: string;
  configurationDigest: string;
  calibrationState: "current" | "not_required" | "expired" | "unknown";
  calibrationEvidenceIds: string[];
  storagePath: string;
  storageVerified: boolean;
  clockSource?: string;
  state: "ready" | "blocked" | "unknown";
  evidenceIds: string[];
}

export interface PreflightOperatorCheck {
  humanRoleId: string;
  actor: string;
  trainingEvidenceIds: string[];
  responsibilitiesAcknowledged: string[];
  authorityBoundaryAcknowledged: boolean;
  state: "ready" | "blocked" | "unknown";
}

export interface PreflightAuthorizationCheck {
  authorizationId: string;
  state: "satisfied" | "not_required" | "missing" | "expired";
  authorityRefs: string[];
  permittedActivities: string[];
  prohibitedActivities: string[];
  evidenceIds: string[];
}

export interface PreflightHazardControl {
  hazardId: string;
  description: string;
  control: string;
  owner: string;
  state: "controlled" | "open" | "not_applicable";
  evidenceIds: string[];
}

export interface PreflightClockCheck {
  clockPolicy: string;
  clockSource: string;
  synchronizedInstrumentationIds: string[];
  maximumAllowedSkewMs: number;
  measuredSkewMs: number;
  state: "ready" | "blocked" | "unknown";
  evidenceIds: string[];
}

export interface PreflightStorageCheck {
  requiredPaths: string[];
  verifiedPaths: string[];
  retentionPolicy: string;
  capacityCheck: string;
  writable: boolean;
  state: "ready" | "blocked" | "unknown";
  evidenceIds: string[];
}

export interface PreflightAbortCheck {
  authorityActors: string[];
  mechanism: string;
  testMethod: string;
  testedAt: string;
  state: "ready" | "blocked" | "unknown";
  evidenceIds: string[];
}

export interface PreflightRunReservation {
  runId: string;
  scenarioId: string;
  reservedAt: string;
  reservationReceiptId: string;
  uniquenessEvidenceIds: string[];
}

export interface CommonsSeededPreflightReceipt {
  schemaVersion: 1;
  receiptId: string;
  caseId: string;
  seededBuildReceiptResultDigest: string;
  asBuiltReceiptDigest: string;
  buildManifestDigest: string;
  qualificationContractDigest: string;
  fixtureChecks: PreflightFixtureCheck[];
  instrumentationChecks: PreflightInstrumentationCheck[];
  operatorChecks: PreflightOperatorCheck[];
  authorizationChecks: PreflightAuthorizationCheck[];
  hazardControls: PreflightHazardControl[];
  clockCheck: PreflightClockCheck;
  storageCheck: PreflightStorageCheck;
  abortCheck: PreflightAbortCheck;
  runReservations: PreflightRunReservation[];
  evidence: PreflightEvidenceRef[];
  preflightAt: string;
  state: "ready" | "blocked" | "superseded";
  qualificationTransferred: false;
  missionEquivalenceClaimed: false;
  receiptDigest: string;
}

export interface CommonsSeededPreflightRequest {
  schemaVersion: 1;
  seededBuildReceiptRequest: CommonsSeededBuildReceiptRequest;
  expectedSeededBuildReceiptResultDigest: string;
  preflightReceipt: CommonsSeededPreflightReceipt;
  admittedAt: string;
}

export type CommonsSeededPreflightFindingState =
  | "seeded_build_receipt_result_mismatch"
  | "seeded_build_receipt_not_admitted"
  | "preflight_receipt_digest_mismatch"
  | "preflight_case_mismatch"
  | "preflight_upstream_digest_mismatch"
  | "preflight_time_order_invalid"
  | "evidence_time_order_invalid"
  | "fixture_check_missing"
  | "fixture_not_ready"
  | "fixture_configuration_mismatch"
  | "instrumentation_check_missing"
  | "instrumentation_identity_mismatch"
  | "instrumentation_configuration_mismatch"
  | "instrumentation_clock_source_mismatch"
  | "instrumentation_calibration_invalid"
  | "instrumentation_storage_unverified"
  | "operator_check_missing"
  | "operator_not_ready"
  | "operator_scope_mismatch"
  | "authorization_check_missing"
  | "authorization_not_satisfied"
  | "authorization_scope_mismatch"
  | "hazard_control_missing"
  | "hazard_control_open"
  | "clock_check_incomplete"
  | "storage_check_incomplete"
  | "abort_check_incomplete"
  | "run_reservation_missing"
  | "run_reservation_duplicate"
  | "run_reservation_scenario_invalid"
  | "evidence_custody_missing"
  | "preflight_state_not_ready"
  | "ordinary_preflight_not_admitted"
  | "qualification_transfer_attempted"
  | "mission_equivalence_attempted"
  | "preflight_validation_failed";

export interface CommonsSeededPreflightFinding {
  state: CommonsSeededPreflightFindingState;
  fixtureId?: string;
  instrumentationId?: string;
  humanRoleId?: string;
  authorizationId?: string;
  runId?: string;
  reason: string;
  requiredAction: string;
}

export type CommonsSeededPreflightState =
  | "seeded_preflight_blocked"
  | "seeded_preflight_incomplete"
  | "seeded_preflight_admitted";

export interface CommonsSeededPreflightResult {
  passed: boolean;
  state: CommonsSeededPreflightState;
  seededBuildReceiptResult?: CommonsSeededBuildReceiptResult;
  seededBuildReceiptResultDigest: string;
  preflightReceiptDigest: string;
  asBuiltReceiptDigest: string;
  readyFixtureIds: string[];
  readyInstrumentationIds: string[];
  readyHumanRoleIds: string[];
  satisfiedAuthorizationIds: string[];
  reservedRunIds: string[];
  findings: CommonsSeededPreflightFinding[];
  validationErrors: string[];
  ordinaryPreflightGate?: PreflightGateResult;
  preflightReceipt?: CommonsSeededPreflightReceipt;
  pullList: string[];
  prohibitedTransitions: string[];
}
