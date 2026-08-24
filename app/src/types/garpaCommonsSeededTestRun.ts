import type { TestRunReceipt, ThresholdResult } from "./garpaExecution";
import type {
  CommonsSeededPreflightRequest,
  CommonsSeededPreflightResult,
} from "./garpaCommonsSeededPreflight";

export interface SeededTestRunArtifactRef {
  artifactId: string;
  sha256: string;
  mediaType: string;
  path: string;
  capturedAt: string;
}

export interface CommonsSeededTestRunEnvelope {
  schemaVersion: 1;
  receiptId: string;
  caseId: string;
  seededPreflightResultDigest: string;
  preflightReceiptDigest: string;
  asBuiltReceiptDigest: string;
  qualificationContractDigest: string;
  runReservationReceiptId: string;
  artifacts: SeededTestRunArtifactRef[];
  executedAt: string;
  qualificationTransferred: false;
  missionEquivalenceClaimed: false;
  envelopeDigest: string;
}

export interface CommonsSeededTestRunRequest {
  schemaVersion: 1;
  seededPreflightRequest: CommonsSeededPreflightRequest;
  expectedSeededPreflightResultDigest: string;
  testRunReceipt: TestRunReceipt;
  executionEnvelope: CommonsSeededTestRunEnvelope;
  admittedAt: string;
}

export type CommonsSeededTestRunFindingState =
  | "seeded_preflight_result_mismatch"
  | "seeded_preflight_not_admitted"
  | "execution_envelope_digest_mismatch"
  | "test_run_result_digest_mismatch"
  | "test_run_case_mismatch"
  | "test_run_upstream_digest_mismatch"
  | "test_run_time_order_invalid"
  | "run_reservation_missing"
  | "run_reservation_scenario_mismatch"
  | "execution_configuration_mismatch"
  | "operator_assignment_mismatch"
  | "fixture_state_mismatch"
  | "environment_observation_mismatch"
  | "required_metric_missing"
  | "required_sample_count_incomplete"
  | "raw_artifact_custody_missing"
  | "valid_run_contains_abort"
  | "valid_run_contains_invalidating_anomaly"
  | "aborted_run_missing_abort_receipt"
  | "invalidated_run_missing_invalidation_receipt"
  | "test_run_state_incomplete"
  | "qualification_transfer_attempted"
  | "mission_equivalence_attempted"
  | "test_run_validation_failed";

export interface CommonsSeededTestRunFinding {
  state: CommonsSeededTestRunFindingState;
  runId?: string;
  scenarioId?: string;
  metricId?: string;
  artifactId?: string;
  reason: string;
  requiredAction: string;
}

export interface CommonsSeededThresholdSummary {
  passMetricIds: string[];
  failMetricIds: string[];
  inconclusiveMetricIds: string[];
  notMeasuredMetricIds: string[];
  byMetricId: Record<string, ThresholdResult>;
}

export type CommonsSeededTestRunState =
  | "seeded_test_run_blocked"
  | "seeded_test_run_incomplete"
  | "seeded_test_run_admitted";

export interface CommonsSeededTestRunResult {
  passed: boolean;
  state: CommonsSeededTestRunState;
  seededPreflightResult?: CommonsSeededPreflightResult;
  seededPreflightResultDigest: string;
  preflightReceiptDigest: string;
  executionEnvelopeDigest: string;
  testRunResultDigest: string;
  runId: string;
  scenarioId: string;
  testRunState?: TestRunReceipt["state"];
  thresholdSummary: CommonsSeededThresholdSummary;
  findings: CommonsSeededTestRunFinding[];
  validationErrors: string[];
  testRunReceipt?: TestRunReceipt;
  executionEnvelope?: CommonsSeededTestRunEnvelope;
  pullList: string[];
  prohibitedTransitions: string[];
}
