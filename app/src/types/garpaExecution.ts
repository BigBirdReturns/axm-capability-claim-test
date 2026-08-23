import type { ArtifactRef, GarpaValidationResult } from "./garpa";

export type BuildExecutionState =
  | "in_progress"
  | "assembled"
  | "blocked"
  | "superseded";

export interface InstalledHardware {
  id: string;
  manifestItemId: string;
  manufacturer?: string;
  model: string;
  revision?: string;
  serialOrLot?: string;
  firmwareVersion?: string;
  quantity: number;
  functionIds: string[];
}

export interface InstalledSoftware {
  id: string;
  manifestItemId: string;
  name: string;
  version: string;
  packageOrImageDigest: string;
  configurationDigest: string;
  functionIds: string[];
}

export interface CodeCommitRef {
  repository: string;
  commit: string;
  dirty: boolean;
  purpose: string;
}

export type DeviationSeverity = "minor" | "material" | "unsafe";
export type DeviationClosureState =
  | "open"
  | "accepted"
  | "requalified"
  | "closed";

export interface BuildDeviation {
  id: string;
  description: string;
  severity: DeviationSeverity;
  affectedFunctionIds: string[];
  affectedMetricIds: string[];
  closureState: DeviationClosureState;
  evidenceArtifactIds: string[];
}

export interface ExecutedSubstitution {
  id: string;
  originalManifestItemId: string;
  replacementInstalledItemId: string;
  policyRef?: string;
  requiredRegressionTestIds: string[];
  rationale: string;
}

export interface ActualCostLine {
  id: string;
  category:
    | "hardware"
    | "software"
    | "services"
    | "fabrication"
    | "integration_labor"
    | "operator_labor"
    | "test_equipment"
    | "qualification"
    | "maintenance"
    | "spares"
    | "communications"
    | "facilities"
    | "energy"
    | "regulatory"
    | "other";
  description: string;
  amount: number;
  currency: string;
  incurredAt: string;
  evidenceArtifactIds: string[];
}

export interface LaborReceipt {
  id: string;
  actor: string;
  category:
    | "research"
    | "procurement"
    | "assembly"
    | "configuration"
    | "custom_development"
    | "integration"
    | "debugging"
    | "test_preparation"
    | "test_execution"
    | "analysis"
    | "documentation";
  hours: number;
  startedAt?: string;
  endedAt?: string;
  notes?: string;
}

export interface BuildReceipt {
  schemaVersion: 1;
  caseId: string;
  buildId: string;
  manifestDigest: string;
  architectureDigest: string;
  qualificationContractDigest: string;
  startedAt: string;
  completedAt?: string;
  installedHardware: InstalledHardware[];
  installedSoftware: InstalledSoftware[];
  codeCommits: CodeCommitRef[];
  substitutions: ExecutedSubstitution[];
  deviations: BuildDeviation[];
  actualCostLines: ActualCostLine[];
  actualLabor: LaborReceipt[];
  artifacts: ArtifactRef[];
  buildDigest: string;
  state: BuildExecutionState;
}

export type ThresholdResult =
  | "pass"
  | "fail"
  | "inconclusive"
  | "not_measured";

export interface ExcludedSample {
  sampleRef: string;
  reason: string;
}

export interface MetricResult {
  metricId: string;
  rawSampleArtifactIds: string[];
  calculationMethod: string;
  codeDigest?: string;
  sampleCount: number;
  excludedSamples: ExcludedSample[];
  value?: number | string | boolean;
  uncertainty?: string;
  thresholdResult: ThresholdResult;
  analystNotes: string[];
}

export interface OperatorIntervention {
  id: string;
  occurredAt: string;
  actor: string;
  description: string;
  affectedMetricIds: string[];
  authorized: boolean;
}

export interface TestAnomaly {
  id: string;
  occurredAt: string;
  description: string;
  affectedMetricIds: string[];
  disposition: "open" | "accepted" | "invalidates_run" | "closed";
}

export interface TestAbort {
  id: string;
  occurredAt: string;
  authority: string;
  reason: string;
}

export type TestRunState =
  | "valid"
  | "invalidated"
  | "aborted"
  | "incomplete";

export interface TestRunReceipt {
  schemaVersion: 1;
  caseId: string;
  runId: string;
  buildDigest: string;
  qualificationContractDigest: string;
  scenarioId: string;
  testId: string;
  startedAt: string;
  endedAt: string;
  operators: string[];
  observers: string[];
  configurationDigest: string;
  fixtureState: Record<string, string>;
  environmentObserved: Record<string, string>;
  rawDataArtifactIds: string[];
  logArtifactIds: string[];
  observationArtifactIds: string[];
  metricResults: MetricResult[];
  interventions: OperatorIntervention[];
  anomalies: TestAnomaly[];
  aborts: TestAbort[];
  resultDigest: string;
  state: TestRunState;
}

export interface PreflightReadiness {
  fixtureReady: boolean;
  instrumentationReady: boolean;
  calibrationReady: boolean;
  storageReady: boolean;
  clocksReady: boolean;
  authorityReady: boolean;
  hazardControlsReady: boolean;
  abortPathReady: boolean;
  operatorRolesReady: boolean;
  runIdReserved: boolean;
}

export interface PreflightGateInput {
  expectedManifestDigest: string;
  expectedQualificationContractDigest: string;
  buildReceipt: BuildReceipt;
  readiness: PreflightReadiness;
}

export interface PreflightGateResult {
  passed: boolean;
  manifestCurrent: boolean;
  qualificationContractCurrent: boolean;
  buildStateAdmissible: boolean;
  materialDeviationsClosed: boolean;
  readiness: PreflightReadiness;
  blockingReasons: string[];
}

export type ExecutionValidationResult<T> = GarpaValidationResult<T>;
