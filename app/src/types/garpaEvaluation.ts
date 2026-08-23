import type { TestRunReceipt, ThresholdResult } from "./garpaExecution";

export type MissionAdequacyState =
  | "matched"
  | "bounded_match"
  | "partial"
  | "failed"
  | "incomparable"
  | "unassessed";

export type MetricEvaluationState =
  | "pass"
  | "fail"
  | "inconclusive"
  | "missing";

export interface MissionEvaluationScope {
  caseId: string;
  qualificationContractDigest: string;
  buildDigest: string;
  requiredScenarioIds: string[];
  essentialMetricIds: string[];
  secondaryMetricIds: string[];
  fullMissionBoundary: boolean;
  boundaryDescription: string;
}

export interface MetricEvaluation {
  metricId: string;
  criticality: "essential" | "secondary";
  state: MetricEvaluationState;
  runIds: string[];
  observedThresholdResults: ThresholdResult[];
  note: string;
}

export interface ScenarioEvaluation {
  scenarioId: string;
  validRunIds: string[];
  excludedRunIds: string[];
  state: "covered" | "missing" | "incomparable";
  note: string;
}

export interface MissionEvaluation {
  schemaVersion: 1;
  caseId: string;
  qualificationContractDigest: string;
  evaluatedBuildDigest: string;
  state: MissionAdequacyState;
  scenarioResults: ScenarioEvaluation[];
  essentialMetricResults: MetricEvaluation[];
  secondaryMetricResults: MetricEvaluation[];
  admittedRunIds: string[];
  excludedRunIds: string[];
  failures: string[];
  residuals: string[];
  incomparableDimensions: string[];
  boundaryDescription: string;
  falsificationLine: string;
}

export interface MissionEvaluationInput {
  scope: MissionEvaluationScope;
  testRunReceipts: TestRunReceipt[];
}
