import type { MissionEvaluation, MissionEvaluationScope } from "./garpaEvaluation";
import type { TestRunReceipt, ThresholdResult } from "./garpaExecution";
import type { PreflightReceipt } from "./garpaPreflight";
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

export interface CommonsSeededMissionBoundary {
  fullMissionBoundary: boolean;
  boundaryDescription: string;
}

export interface CommonsSeededMissionRunBinding {
  runId: string;
  scenarioId: string;
  reservationReceiptId: string;
  expectedTestRunResultDigest: string;
  expectedTestRunReceiptDigest: string;
  expectedSeededPreflightResultDigest: string;
  expectedPreflightReceiptDigest: string;
  expectedAsBuiltReceiptDigest: string;
  expectedQualificationContractDigest: string;
}

export interface CommonsSeededMissionEvaluationEnvelope {
  schemaVersion: 1;
  evaluationId: string;
  caseId: string;
  missionOutcomeDigest: string;
  qualificationContractDigest: string;
  asBuiltReceiptDigest: string;
  campaignPreflightReceiptDigest: string;
  runSetDigest: string;
  runBindings: CommonsSeededMissionRunBinding[];
  evaluatedAt: string;
  qualificationTransferred: false;
  missionEquivalenceClaimed: false;
  envelopeDigest: string;
}

export interface CommonsSeededMissionEvaluationRequest {
  schemaVersion: 1;
  testRunRequests: CommonsSeededTestRunRequest[];
  missionBoundary: CommonsSeededMissionBoundary;
  evaluationEnvelope: CommonsSeededMissionEvaluationEnvelope;
  admittedAt: string;
}

export type CommonsSeededMissionEvaluationFindingState =
  | "test_run_request_invalid"
  | "test_run_result_mismatch"
  | "test_run_blocked"
  | "run_binding_missing"
  | "run_binding_unexpected"
  | "run_binding_mismatch"
  | "run_set_duplicate"
  | "run_set_incomplete"
  | "reserved_run_omitted"
  | "campaign_preflight_mismatch"
  | "evaluation_envelope_digest_mismatch"
  | "run_set_digest_mismatch"
  | "evaluation_case_mismatch"
  | "evaluation_upstream_digest_mismatch"
  | "evaluation_time_order_invalid"
  | "scenario_coverage_incomplete"
  | "metric_coverage_incomplete"
  | "essential_metric_inconclusive"
  | "mission_boundary_mismatch"
  | "custodied_evaluation_failed"
  | "custodied_evaluation_state_missing"
  | "qualification_transfer_attempted"
  | "mission_equivalence_attempted"
  | "mission_evaluation_validation_failed";

export interface CommonsSeededMissionEvaluationFinding {
  state: CommonsSeededMissionEvaluationFindingState;
  runId?: string;
  scenarioId?: string;
  metricId?: string;
  reason: string;
  requiredAction: string;
}

export type CommonsSeededMissionEvaluationState =
  | "seeded_mission_evaluation_blocked"
  | "seeded_mission_evaluation_incomplete"
  | "seeded_mission_evaluation_admitted";

export type CommonsSeededCoverageState =
  | "complete"
  | "failed"
  | "inconclusive"
  | "insufficient";

export interface CommonsSeededScenarioCoverage {
  scenarioId: string;
  requiredValidRuns: number;
  submittedRunIds: string[];
  validRunIds: string[];
  abortedRunIds: string[];
  invalidatedRunIds: string[];
  incompleteRunIds: string[];
  state: "complete" | "insufficient";
}

export interface CommonsSeededMetricCoverage {
  metricId: string;
  criticality: "essential" | "secondary" | "diagnostic";
  requiredValidRuns: number;
  minimumSamplesPerRun: number;
  totalValidSamples: number;
  validRunIds: string[];
  passRunIds: string[];
  failRunIds: string[];
  inconclusiveRunIds: string[];
  notMeasuredRunIds: string[];
  sampleDeficientRunIds: string[];
  observedThresholdResults: ThresholdResult[];
  state: CommonsSeededCoverageState;
}

export interface CommonsSeededRunDisposition {
  runId: string;
  scenarioId: string;
  testRunGateState: CommonsSeededTestRunResult["state"];
  receiptState: TestRunReceipt["state"];
  retained: boolean;
  delegated: boolean;
  excluded: boolean;
  exclusionReasons: string[];
}

export interface CommonsSeededMissionEvaluationResult {
  passed: boolean;
  state: CommonsSeededMissionEvaluationState;
  missionState?: CommonsSeededMissionState;
  missionEvaluationScope?: MissionEvaluationScope;
  custodiedMissionEvaluationResult?: MissionEvaluation;
  custodiedMissionEvaluationResultDigest: string;
  evaluationEnvelopeDigest: string;
  campaignPreflightReceiptDigest: string;
  runSetDigest: string;
  admittedTestRunResultDigests: string[];
  submittedRunIds: string[];
  retainedRunIds: string[];
  delegatedRunIds: string[];
  excludedRunIds: string[];
  validRunIds: string[];
  failedMetricIds: string[];
  abortedRunIds: string[];
  invalidatedRunIds: string[];
  incompleteRunIds: string[];
  scenarioCoverage: CommonsSeededScenarioCoverage[];
  metricCoverage: CommonsSeededMetricCoverage[];
  runDispositions: CommonsSeededRunDisposition[];
  findings: CommonsSeededMissionEvaluationFinding[];
  validationErrors: string[];
  testRunResults: CommonsSeededTestRunResult[];
  testRunReceipts: TestRunReceipt[];
  ordinaryPreflightReceipts: PreflightReceipt[];
  pullList: string[];
  prohibitedTransitions: string[];
}
