import type {
  ClaimPacket,
  EvidenceBoundValue,
  EvidenceCell,
  EvidenceTarget,
  GoalGateResult,
  MissionOutcome,
  OutcomeMetric,
} from "../../types/garpa";

const VAGUE_LANGUAGE = /\b(?:effective|affordable|advanced|best|fast|high[- ]performance|low[- ]cost|robust|revolutionary|fraction of the cost)\b/i;

const TARGETS: Record<string, ReadonlySet<EvidenceTarget>> = {
  operator: new Set(["operator_need", "advertised_outcome", "claim_was_made"]),
  protected_or_affected_object: new Set([
    "operator_need",
    "advertised_outcome",
    "claim_was_made",
  ]),
  problem_or_threat: new Set(["operator_need", "advertised_outcome", "claim_was_made"]),
  desired_state_change: new Set([
    "operator_need",
    "advertised_outcome",
    "claim_was_made",
  ]),
  operating_environment: new Set(["operating_environment"]),
  time_and_coverage_requirement: new Set(["operator_need", "operating_environment"]),
  success_metrics: new Set([
    "operator_need",
    "advertised_outcome",
    "performance_observed",
    "local_result",
  ]),
};

function hasTargetedEvidence(
  ids: string[],
  cells: ReadonlyMap<string, EvidenceCell>,
  targets: ReadonlySet<EvidenceTarget>,
  requireExternal: boolean,
): boolean {
  return ids.some((id) => {
    const cell = cells.get(id);
    if (!cell || !targets.has(cell.target)) return false;
    if (!requireExternal) return true;
    return ["externally_attributed", "independent", "local_measured"].includes(
      cell.control,
    );
  });
}

function valueAdmitted(
  field: string,
  value: EvidenceBoundValue<string>,
  cells: ReadonlyMap<string, EvidenceCell>,
): boolean {
  if (!value.value?.trim()) return false;
  if (value.basis === "open" || value.basis === "analyst_hypothesis") return false;
  return hasTargetedEvidence(
    value.evidenceCellIds,
    cells,
    TARGETS[field]!,
    value.basis === "externally_supported",
  );
}

function metricHasThreshold(metric: OutcomeMetric): boolean {
  if (metric.comparator === "range") {
    return metric.lowerBound !== undefined && metric.upperBound !== undefined;
  }
  return metric.threshold !== undefined;
}

function metricAdmitted(
  metric: OutcomeMetric,
  cells: ReadonlyMap<string, EvidenceCell>,
): boolean {
  if (metric.basis === "open" || metric.basis === "analyst_hypothesis") return false;
  if (!metricHasThreshold(metric)) return false;
  if (VAGUE_LANGUAGE.test(metric.name)) return false;
  if (typeof metric.threshold === "string" && VAGUE_LANGUAGE.test(metric.threshold)) return false;
  return hasTargetedEvidence(
    metric.evidenceCellIds,
    cells,
    TARGETS.success_metrics!,
    metric.basis === "externally_supported",
  );
}

function pullFor(field: string): string {
  const pulls: Record<string, string> = {
    operator: "Identify the customer, operator, or operator class buying the outcome.",
    protected_or_affected_object:
      "Identify the object, site, process, or population whose state must change.",
    problem_or_threat: "State the problem or threat in testable terms.",
    desired_state_change: "State the desired change without importing the vendor architecture.",
    operating_environment:
      "Define the environment and constraints in which the outcome must hold.",
    time_and_coverage_requirement:
      "Define the required duration, response time, coverage, throughput, or availability boundary.",
    success_metrics:
      "Define at least one falsifiable success metric with a unit or categorical threshold.",
    metric_baseline:
      "Attach a numerical, categorical, or boolean baseline to each admitted success metric.",
  };
  return pulls[field] ?? `Resolve ${field}.`;
}

export function runGoalGate(
  outcome: MissionOutcome,
  packet: ClaimPacket,
): GoalGateResult {
  const cells = new Map(packet.evidence.map((cell) => [cell.id, cell]));
  const admittedFields: string[] = [];
  const missingFields: string[] = [];

  const values: Array<[string, EvidenceBoundValue<string>]> = [
    ["operator", outcome.operator],
    ["protected_or_affected_object", outcome.protectedOrAffectedObject],
    ["problem_or_threat", outcome.problemOrThreat],
    ["desired_state_change", outcome.desiredStateChange],
    ["operating_environment", outcome.operatingEnvironment],
    ["time_and_coverage_requirement", outcome.timeAndCoverageRequirement],
  ];

  for (const [field, value] of values) {
    (valueAdmitted(field, value, cells) ? admittedFields : missingFields).push(field);
  }

  const admittedMetrics = outcome.successMetrics.filter((metric) =>
    metricAdmitted(metric, cells),
  );
  const rejectedMetricIds = outcome.successMetrics
    .filter((metric) => !metricAdmitted(metric, cells))
    .map((metric) => metric.id);
  const missingBaselineMetricIds = admittedMetrics
    .filter((metric) => metric.baseline === undefined)
    .map((metric) => metric.id);

  if (admittedMetrics.length > 0) admittedFields.push("success_metrics");
  else missingFields.push("success_metrics");

  if (missingBaselineMetricIds.length > 0 || admittedMetrics.length === 0) {
    missingFields.push("metric_baseline");
  } else {
    admittedFields.push("metric_baseline");
  }

  const ambiguousFields = missingFields.filter(
    (field) => field !== "success_metrics" && field !== "metric_baseline",
  );
  const state = ambiguousFields.length > 0
    ? "goal_ambiguous"
    : admittedMetrics.length === 0
      ? "success_metric_missing"
      : missingBaselineMetricIds.length > 0
        ? "baseline_missing"
        : "admitted_for_decomposition";

  return {
    state,
    passed: state === "admitted_for_decomposition",
    admittedFields,
    missingFields: Array.from(new Set(missingFields)),
    rejectedMetricIds,
    missingBaselineMetricIds,
    pullList: Array.from(new Set(missingFields)).map(pullFor),
  };
}
