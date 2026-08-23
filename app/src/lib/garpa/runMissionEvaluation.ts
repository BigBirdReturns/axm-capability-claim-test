import type {
  MetricResult,
  MissionEvaluation,
  MissionEvaluationRequest,
  TestRunReceipt,
} from "../../types/garpaExecution";

function runIsAdmissible(
  run: TestRunReceipt,
  request: MissionEvaluationRequest,
): boolean {
  return (
    run.state === "valid" &&
    run.caseId === request.caseId &&
    run.qualificationContractDigest === request.qualificationContractDigest &&
    run.buildReceiptDigest === request.buildReceiptDigest &&
    run.rawDataArtifactIds.length > 0 &&
    run.logArtifactIds.length > 0 &&
    run.aborts.length === 0 &&
    !run.anomalies.some((anomaly) => anomaly.disposition === "invalidates_run")
  );
}

function resultsForMetric(
  runs: TestRunReceipt[],
  metricId: string,
): MetricResult[] {
  return runs.flatMap((run) =>
    run.metricResults.filter((result) => result.metricId === metricId),
  );
}

function falsificationLine(state: MissionEvaluation["state"]): string {
  switch (state) {
    case "matched":
      return "A valid repeat under the full frozen mission boundary that fails any essential metric would overturn the match.";
    case "bounded_match":
      return "A valid run inside the stated boundary that fails an essential metric would overturn the bounded match; extending the boundary requires new qualification.";
    case "failed":
      return "A corrected build must pass every failed essential metric for the required number of valid runs under the same frozen contract.";
    case "partial":
      return "Complete the missing scenarios, metrics, and required repetitions without changing the frozen thresholds.";
    case "incomparable":
      return "Produce a valid run against the referenced build and qualification digests with complete raw-data and log custody.";
    case "unassessed":
      return "Submit at least one valid test-run receipt under the frozen build and qualification contract.";
  }
}

export function runMissionEvaluation(
  request: MissionEvaluationRequest,
): MissionEvaluation {
  const validRuns = request.runs.filter((run) => runIsAdmissible(run, request));
  const excludedRuns = request.runs.filter((run) => !runIsAdmissible(run, request));

  const observedScenarioIds = new Set(validRuns.map((run) => run.scenarioId));
  const missingScenarioIds = request.requiredScenarioIds.filter(
    (scenarioId) => !observedScenarioIds.has(scenarioId),
  );

  const missingMetricIds: string[] = [];
  const insufficientRunMetricIds: string[] = [];
  const failedEssentialMetricIds: string[] = [];
  const inconclusiveEssentialMetricIds: string[] = [];
  const essential = new Set(request.essentialMetricIds);

  for (const metricId of request.requiredMetricIds) {
    const results = resultsForMetric(validRuns, metricId);
    const measured = results.filter(
      (result) => result.thresholdResult !== "not_measured",
    );
    const requiredRuns = request.requiredRunsByMetric[metricId] ?? 1;

    if (results.length === 0) missingMetricIds.push(metricId);
    if (measured.length < requiredRuns) insufficientRunMetricIds.push(metricId);

    if (essential.has(metricId)) {
      if (measured.some((result) => result.thresholdResult === "fail")) {
        failedEssentialMetricIds.push(metricId);
      }
      if (
        results.some(
          (result) =>
            result.thresholdResult === "inconclusive" ||
            result.thresholdResult === "not_measured",
        ) ||
        measured.length < requiredRuns
      ) {
        inconclusiveEssentialMetricIds.push(metricId);
      }
    }
  }

  const unique = (values: string[]): string[] => Array.from(new Set(values));
  const failedEssential = unique(failedEssentialMetricIds);
  const inconclusiveEssential = unique(inconclusiveEssentialMetricIds);
  const missingMetrics = unique(missingMetricIds);
  const insufficientRuns = unique(insufficientRunMetricIds);

  const state: MissionEvaluation["state"] =
    request.runs.length === 0
      ? "unassessed"
      : validRuns.length === 0
        ? "incomparable"
        : failedEssential.length > 0
          ? "failed"
          : missingScenarioIds.length > 0 ||
              missingMetrics.length > 0 ||
              insufficientRuns.length > 0 ||
              inconclusiveEssential.length > 0
            ? "partial"
            : request.scopeIsFullMission
              ? "matched"
              : "bounded_match";

  const residuals: string[] = [];
  if (missingScenarioIds.length > 0) {
    residuals.push(`Missing required scenarios: ${missingScenarioIds.join(", ")}.`);
  }
  if (missingMetrics.length > 0) {
    residuals.push(`Missing required metrics: ${missingMetrics.join(", ")}.`);
  }
  if (insufficientRuns.length > 0) {
    residuals.push(
      `Insufficient valid repetitions for metrics: ${insufficientRuns.join(", ")}.`,
    );
  }
  if (inconclusiveEssential.length > 0) {
    residuals.push(
      `Essential metrics remain inconclusive: ${inconclusiveEssential.join(", ")}.`,
    );
  }
  if (failedEssential.length > 0) {
    residuals.push(`Failed essential metrics: ${failedEssential.join(", ")}.`);
  }
  if (!request.scopeIsFullMission && state === "bounded_match") {
    residuals.push(
      "The result applies only to the frozen evaluated boundary and does not establish full-mission or vendor-system equivalence.",
    );
  }
  if (excludedRuns.length > 0) {
    residuals.push(
      `${excludedRuns.length} run receipt${excludedRuns.length === 1 ? " was" : "s were"} excluded from acceptance but retained in the case record.`,
    );
  }

  return {
    caseId: request.caseId,
    qualificationContractDigest: request.qualificationContractDigest,
    evaluatedBuildReceiptDigest: request.buildReceiptDigest,
    state,
    validRunIds: validRuns.map((run) => run.runId),
    excludedRunIds: excludedRuns.map((run) => run.runId),
    missingScenarioIds,
    missingMetricIds: missingMetrics,
    insufficientRunMetricIds: insufficientRuns,
    failedEssentialMetricIds: failedEssential,
    inconclusiveEssentialMetricIds: inconclusiveEssential,
    residuals,
    falsificationLine: falsificationLine(state),
  };
}
