import type { TestRunReceipt } from "./garpaExecution";
import type {
  CommonsSeededTestRunRequest,
  CommonsSeededTestRunResult,
} from "./garpaCommonsSeededTestRun";

export type CommonsSeededMissionState =
  | "matched"
  | "bounded_match"
  | "partial"
  | "failed"
  | "incomparable"
  | "unassessed";

export interface CommonsSeededMissionRunBinding {
  runId: string;
  expectedTestRunResultDigest: string;
  expectedTestRunReceiptDigest: string;
  scenarioId: string;
}

export interface CommonsSeededMissionEvaluationEnvelope {
  schemaVersion: 1;
  evaluationId: string;
  caseId: string;
  qualificationContractDigest: string;
  asBuiltReceiptDigest: string;
  preflightReceiptDigest: string;
  runBindings: CommonsSeededMissionRunBinding[];
  evaluatedAt: string;
  qualificationTransferred: false;
  missionEquivalenceClaimed: false;
  envelopeDigest: string;
}

export interface CommonsSeededMissionEvaluationRequest {
  schemaVersion: 1;
  testRunRequests: CommonsSeededTestRunRequest[];
  custodiedMissionEvaluationArgs: unknown[];
  evaluationEnvelope: CommonsSeededMissionEvaluationEnvelope;
  admittedAt: string;
}

export type CommonsSeededMissionEvaluationFindingState =
  | "test_run_request_invalid"
  | "test_run_result_mismatch"
  | "test_run_not_admitted"
  | "run_binding_missing"
  | "run_binding_unexpected"
  | "run_binding_mismatch"
  | "run_set_duplicate"
  | "run_set_incomplete"
  | "run_omitted_from_custodied_evaluation"
  | "unbound_run_in_custodied_evaluation"
  | "run_receipt_mismatch"
  | "evaluation_envelope_digest_mismatch"
  | "evaluation_case_mismatch"
  | "evaluation_upstream_digest_mismatch"
  | "evaluation_time_order_invalid"
  | "custodied_evaluation_failed"
  | "custodied_evaluation_state_missing"
  | "qualification_transfer_attempted"
  | "mission_equivalence_attempted"
  | "mission_evaluation_validation_failed";

export interface CommonsSeededMissionEvaluationFinding {
  state: CommonsSeededMissionEvaluationFindingState;
  runId?: string;
  scenarioId?: string;
  reason: string;
  requiredAction: string;
}

export type CommonsSeededMissionEvaluationState =
  | "seeded_mission_evaluation_blocked"
  | "seeded_mission_evaluation_incomplete"
  | "seeded_mission_evaluation_admitted";

export interface CommonsSeededMissionEvaluationResult {
  passed: boolean;
  state: CommonsSeededMissionEvaluationState;
  missionState?: CommonsSeededMissionState;
  custodiedMissionEvaluationResult?: unknown;
  custodiedMissionEvaluationResultDigest: string;
  evaluationEnvelopeDigest: string;
  admittedTestRunResultDigests: string[];
  admittedRunIds: string[];
  validRunIds: string[];
  failedMetricIds: string[];
  abortedRunIds: string[];
  invalidatedRunIds: string[];
  incompleteRunIds: string[];
  findings: CommonsSeededMissionEvaluationFinding[];
  validationErrors: string[];
  testRunResults: CommonsSeededTestRunResult[];
  testRunReceipts: TestRunReceipt[];
  pullList: string[];
  prohibitedTransitions: string[];
}
