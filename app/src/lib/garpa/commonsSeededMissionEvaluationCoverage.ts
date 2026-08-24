import type { MissionEvaluationScope } from "../../types/garpaEvaluation";
import type {
  CommonsSeededMetricCoverage,
  CommonsSeededMissionBoundary,
  CommonsSeededMissionEvaluationFinding,
  CommonsSeededScenarioCoverage,
} from "../../types/garpaCommonsSeededMissionEvaluation";
import type { QualificationMetric } from "../../types/garpaQualification";
import {
  type RunEntry,
  addFinding,
  asBuiltOf,
  missionOutcomeOf,
  qualificationOf,
  sorted,
} from "./commonsSeededMissionEvaluationGateSupport";

function requiredValidRuns(minimum: number): number {
  return Number.isInteger(minimum) && minimum > 0 ? minimum : 1;
}

export function buildMissionEvaluationScope(
  first: RunEntry,
  boundary: CommonsSeededMissionBoundary,
  findings: CommonsSeededMissionEvaluationFinding[],
): MissionEvaluationScope {
  const qualification = qualificationOf(first.request);
  const asBuilt = asBuiltOf(first.request);
  const missionOutcome = missionOutcomeOf(first.request);
  const scenarioExclusions = qualification.scenarios.flatMap(
    (scenario) => scenario.excludedConditions,
  );
  if (
    boundary.fullMissionBoundary &&
    (missionOutcome.exclusions.length > 0 || scenarioExclusions.length > 0)
  ) {
    addFinding(
      findings,
      "mission_boundary_mismatch",
      "The request declares a full-mission boundary while the frozen target mission or qualification scenarios retain explicit exclusions.",
      "Set a bounded mission boundary or supersede the frozen mission and qualification contract without exclusions.",
    );
  }
  return {
    caseId: qualification.caseId,
    qualificationContractDigest: asBuilt.qualificationContractDigest,
    buildDigest: asBuilt.receiptDigest,
    requiredScenarioIds: qualification.scenarios.map((scenario) => scenario.id),
    essentialMetricIds: qualification.metrics
      .filter((metric) => metric.criticality === "essential")
      .map((metric) => metric.id),
    secondaryMetricIds: qualification.metrics
      .filter((metric) => metric.criticality !== "essential")
      .map((metric) => metric.id),
    fullMissionBoundary: boundary.fullMissionBoundary,
    boundaryDescription: boundary.boundaryDescription,
  };
}

export function evaluateScenarioCoverage(
  first: RunEntry,
  entries: RunEntry[],
  findings: CommonsSeededMissionEvaluationFinding[],
): CommonsSeededScenarioCoverage[] {
  const qualification = qualificationOf(first.request);
  const required = requiredValidRuns(
    qualification.acceptanceRule.minimumValidRunsPerMetric,
  );
  return qualification.scenarios.map((scenario) => {
    const submitted = entries.filter(
      (entry) => entry.receipt.scenarioId === scenario.id,
    );
    const validRunIds = sorted(
      submitted
        .filter(
          (entry) => entry.result.passed && entry.receipt.state === "valid",
        )
        .map((entry) => entry.receipt.runId),
    );
    const state = validRunIds.length >= required ? "complete" : "insufficient";
    if (state === "insufficient") {
      addFinding(
        findings,
        "scenario_coverage_incomplete",
        `Scenario ${scenario.id} has ${validRunIds.length} admitted valid runs; ${required} are required by the frozen acceptance rule.`,
        "Complete and receipt the remaining reserved executions without changing the scenario or acceptance rule.",
        { scenarioId: scenario.id },
      );
    }
    return {
      scenarioId: scenario.id,
      requiredValidRuns: required,
      submittedRunIds: sorted(submitted.map((entry) => entry.receipt.runId)),
      validRunIds,
      abortedRunIds: sorted(
        submitted
          .filter((entry) => entry.receipt.state === "aborted")
          .map((entry) => entry.receipt.runId),
      ),
      invalidatedRunIds: sorted(
        submitted
          .filter((entry) => entry.receipt.state === "invalidated")
          .map((entry) => entry.receipt.runId),
      ),
      incompleteRunIds: sorted(
        submitted
          .filter(
            (entry) =>
              entry.receipt.state === "incomplete" ||
              entry.result.state === "seeded_test_run_incomplete",
          )
          .map((entry) => entry.receipt.runId),
      ),
      state,
    };
  });
}

function coverageForMetric(
  metric: QualificationMetric,
  first: RunEntry,
  entries: RunEntry[],
  findings: CommonsSeededMissionEvaluationFinding[],
): CommonsSeededMetricCoverage {
  const qualification = qualificationOf(first.request);
  const required = requiredValidRuns(
    qualification.acceptanceRule.minimumValidRunsPerMetric,
  );
  const scenarioIds = new Set(
    qualification.scenarios
      .filter((scenario) => scenario.metricIds.includes(metric.id))
      .map((scenario) => scenario.id),
  );
  const observations = entries.flatMap((entry) => {
    if (!scenarioIds.has(entry.receipt.scenarioId)) return [];
    const result = entry.receipt.metricResults.find(
      (candidate) => candidate.metricId === metric.id,
    );
    return result ? [{ entry, result }] : [];
  });
  const sufficient = observations.filter(
    ({ entry, result }) =>
      entry.result.passed &&
      entry.receipt.state === "valid" &&
      result.sampleCount >= metric.requiredRuns,
  );
  const measured = sufficient.filter(
    ({ result }) => result.thresholdResult !== "not_measured",
  );
  const passRunIds = sorted(
    sufficient
      .filter(({ result }) => result.thresholdResult === "pass")
      .map(({ entry }) => entry.receipt.runId),
  );
  const failRunIds = sorted(
    sufficient
      .filter(({ result }) => result.thresholdResult === "fail")
      .map(({ entry }) => entry.receipt.runId),
  );
  const inconclusiveRunIds = sorted(
    sufficient
      .filter(({ result }) => result.thresholdResult === "inconclusive")
      .map(({ entry }) => entry.receipt.runId),
  );
  const notMeasuredRunIds = sorted(
    sufficient
      .filter(({ result }) => result.thresholdResult === "not_measured")
      .map(({ entry }) => entry.receipt.runId),
  );
  const sampleDeficientRunIds = sorted(
    observations
      .filter(({ result }) => result.sampleCount < metric.requiredRuns)
      .map(({ entry }) => entry.receipt.runId),
  );
  const validRunIds = sorted(measured.map(({ entry }) => entry.receipt.runId));
  const observedThresholdResults = measured.map(
    ({ result }) => result.thresholdResult,
  );
  const totalValidSamples = measured.reduce(
    (total, { result }) => total + result.sampleCount,
    0,
  );

  let state: CommonsSeededMetricCoverage["state"] = "complete";
  if (failRunIds.length > 0) state = "failed";
  else if (inconclusiveRunIds.length > 0 || notMeasuredRunIds.length > 0) {
    state = "inconclusive";
  } else if (validRunIds.length < required || sampleDeficientRunIds.length > 0) {
    state = "insufficient";
  }

  if (validRunIds.length < required || sampleDeficientRunIds.length > 0) {
    addFinding(
      findings,
      "metric_coverage_incomplete",
      `Metric ${metric.id} has ${validRunIds.length} admitted measured runs; ${required} are required, and ${sampleDeficientRunIds.length} submitted runs are sample-deficient.`,
      "Complete the frozen number of valid runs and minimum samples per run without changing the threshold.",
      { metricId: metric.id },
    );
  }
  if (
    metric.criticality === "essential" &&
    (inconclusiveRunIds.length > 0 || notMeasuredRunIds.length > 0) &&
    !qualification.acceptanceRule.allowInconclusiveEssential
  ) {
    addFinding(
      findings,
      "essential_metric_inconclusive",
      `Essential metric ${metric.id} contains inconclusive or not-measured admitted observations.`,
      "Resolve every essential observation under the frozen method; secondary metrics cannot substitute for it.",
      { metricId: metric.id },
    );
  }

  return {
    metricId: metric.id,
    criticality: metric.criticality,
    requiredValidRuns: required,
    minimumSamplesPerRun: metric.requiredRuns,
    totalValidSamples,
    validRunIds,
    passRunIds,
    failRunIds,
    inconclusiveRunIds,
    notMeasuredRunIds,
    sampleDeficientRunIds,
    observedThresholdResults,
    state,
  };
}

export function evaluateMetricCoverage(
  first: RunEntry,
  entries: RunEntry[],
  findings: CommonsSeededMissionEvaluationFinding[],
): CommonsSeededMetricCoverage[] {
  return qualificationOf(first.request).metrics.map((metric) =>
    coverageForMetric(metric, first, entries, findings),
  );
}
