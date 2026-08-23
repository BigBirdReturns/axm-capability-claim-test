import type {
  MetricEvaluation,
  MissionEvaluation,
  MissionEvaluationInput,
  ScenarioEvaluation,
} from "../../types/garpaEvaluation";
import type { TestRunReceipt, ThresholdResult } from "../../types/garpaExecution";

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function comparableRun(
  run: TestRunReceipt,
  buildDigest: string,
  qualificationContractDigest: string,
): boolean {
  return (
    run.buildDigest === buildDigest &&
    run.qualificationContractDigest === qualificationContractDigest
  );
}

function evaluateMetric(
  metricId: string,
  criticality: "essential" | "secondary",
  runs: TestRunReceipt[],
): MetricEvaluation {
  const observations = runs.flatMap((run) =>
    run.metricResults
      .filter((metric) => metric.metricId === metricId)
      .map((metric) => ({ runId: run.runId, result: metric.thresholdResult })),
  );
  const runIds = unique(observations.map((observation) => observation.runId));
  const observedThresholdResults = observations.map(
    (observation) => observation.result,
  );

  if (observations.length === 0) {
    return {
      metricId,
      criticality,
      state: "missing",
      runIds: [],
      observedThresholdResults: [],
      note: "No admitted run measured this metric.",
    };
  }
  if (observedThresholdResults.includes("fail")) {
    return {
      metricId,
      criticality,
      state: "fail",
      runIds,
      observedThresholdResults,
      note: "At least one admitted run failed the frozen threshold.",
    };
  }
  if (
    observedThresholdResults.includes("inconclusive") ||
    observedThresholdResults.includes("not_measured")
  ) {
    return {
      metricId,
      criticality,
      state: "inconclusive",
      runIds,
      observedThresholdResults,
      note: "The available admitted runs do not resolve this metric.",
    };
  }
  return {
    metricId,
    criticality,
    state: "pass",
    runIds,
    observedThresholdResults,
    note: "Every admitted observation of this metric passed the frozen threshold.",
  };
}

function scenarioEvaluation(
  scenarioId: string,
  comparableRuns: TestRunReceipt[],
  excludedRuns: TestRunReceipt[],
): ScenarioEvaluation {
  const validRunIds = comparableRuns
    .filter((run) => run.scenarioId === scenarioId && run.state === "valid")
    .map((run) => run.runId);
  const excludedRunIds = excludedRuns
    .filter((run) => run.scenarioId === scenarioId)
    .map((run) => run.runId);

  if (validRunIds.length > 0) {
    return {
      scenarioId,
      validRunIds,
      excludedRunIds,
      state: "covered",
      note: "At least one comparable valid run covers this required scenario.",
    };
  }
  if (excludedRunIds.length > 0) {
    return {
      scenarioId,
      validRunIds: [],
      excludedRunIds,
      state: "incomparable",
      note: "Runs exist for this scenario, but none are both current and valid.",
    };
  }
  return {
    scenarioId,
    validRunIds: [],
    excludedRunIds: [],
    state: "missing",
    note: "No run covers this required scenario.",
  };
}

function falsificationLine(state: MissionEvaluation["state"]): string {
  if (state === "matched" || state === "bounded_match") {
    return "Repeat the frozen scenarios with the same build and qualification contract. Any essential-metric failure or inability to reproduce the valid runs overturns the match.";
  }
  if (state === "failed") {
    return "Produce valid comparable runs in which every essential metric passes across every required scenario to overturn the failure.";
  }
  return "Supply valid current runs for every required scenario and resolve every missing or inconclusive essential metric.";
}

export function evaluateMissionAdequacy(
  input: MissionEvaluationInput,
): MissionEvaluation {
  const { scope, testRunReceipts } = input;
  const currentRuns = testRunReceipts.filter((run) =>
    comparableRun(run, scope.buildDigest, scope.qualificationContractDigest),
  );
  const comparableValidRuns = currentRuns.filter((run) => run.state === "valid");
  const excludedRuns = testRunReceipts.filter(
    (run) =>
      !comparableRun(run, scope.buildDigest, scope.qualificationContractDigest) ||
      run.state !== "valid",
  );

  const scenarioResults = scope.requiredScenarioIds.map((scenarioId) =>
    scenarioEvaluation(scenarioId, comparableValidRuns, excludedRuns),
  );
  const requiredScenarioSet = new Set(scope.requiredScenarioIds);
  const admittedRuns = comparableValidRuns.filter((run) =>
    requiredScenarioSet.has(run.scenarioId),
  );

  const essentialMetricResults = scope.essentialMetricIds.map((metricId) =>
    evaluateMetric(metricId, "essential", admittedRuns),
  );
  const secondaryMetricResults = scope.secondaryMetricIds.map((metricId) =>
    evaluateMetric(metricId, "secondary", admittedRuns),
  );

  const failures = essentialMetricResults
    .filter((metric) => metric.state === "fail")
    .map((metric) => `Essential metric ${metric.metricId} failed.`);
  const unresolvedEssential = essentialMetricResults.filter(
    (metric) => metric.state === "missing" || metric.state === "inconclusive",
  );
  const uncoveredScenarios = scenarioResults.filter(
    (scenario) => scenario.state !== "covered",
  );
  const incomparableDimensions: string[] = [];

  for (const run of excludedRuns) {
    if (run.buildDigest !== scope.buildDigest) {
      incomparableDimensions.push(`Run ${run.runId} uses a different build digest.`);
    }
    if (run.qualificationContractDigest !== scope.qualificationContractDigest) {
      incomparableDimensions.push(
        `Run ${run.runId} uses a different qualification-contract digest.`,
      );
    }
    if (run.state !== "valid") {
      incomparableDimensions.push(`Run ${run.runId} has state ${run.state}.`);
    }
  }

  let state: MissionEvaluation["state"];
  if (
    comparableValidRuns.length === 0 &&
    incomparableDimensions.length > 0 &&
    testRunReceipts.length > 0
  ) {
    state = "incomparable";
  } else if (comparableValidRuns.length === 0) {
    state = "unassessed";
  } else if (failures.length > 0) {
    state = "failed";
  } else if (uncoveredScenarios.length > 0 || unresolvedEssential.length > 0) {
    state = "partial";
  } else {
    state = scope.fullMissionBoundary ? "matched" : "bounded_match";
  }

  const residuals = [
    ...uncoveredScenarios.map(
      (scenario) => `Required scenario ${scenario.scenarioId} is ${scenario.state}.`,
    ),
    ...unresolvedEssential.map(
      (metric) => `Essential metric ${metric.metricId} is ${metric.state}.`,
    ),
  ];
  if (!scope.fullMissionBoundary) {
    residuals.push(
      `Evaluation covers a bounded mission slice: ${scope.boundaryDescription}`,
    );
  }

  return {
    schemaVersion: 1,
    caseId: scope.caseId,
    qualificationContractDigest: scope.qualificationContractDigest,
    evaluatedBuildDigest: scope.buildDigest,
    state,
    scenarioResults,
    essentialMetricResults,
    secondaryMetricResults,
    admittedRunIds: admittedRuns.map((run) => run.runId),
    excludedRunIds: excludedRuns.map((run) => run.runId),
    failures,
    residuals,
    incomparableDimensions: unique(incomparableDimensions),
    boundaryDescription: scope.boundaryDescription,
    falsificationLine: falsificationLine(state),
  };
}
