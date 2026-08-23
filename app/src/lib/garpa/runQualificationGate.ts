import type { MissionOutcome, OutcomeMetric } from "../../types/garpa";
import type {
  ArchitectureGateResult,
  CandidateArchitecture,
} from "../../types/garpaArchitecture";
import type {
  QualificationContract,
  QualificationGateResult,
  QualificationMetric,
} from "../../types/garpaQualification";

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function missionDirection(metric: OutcomeMetric): QualificationMetric["direction"] {
  if (metric.comparator === "gte") return "higher_is_better";
  if (metric.comparator === "lte") return "lower_is_better";
  if (metric.comparator === "range") return "inside_range";
  return metric.comparator;
}

function sameScalar(
  left: number | string | boolean | undefined,
  right: number | string | boolean | undefined,
): boolean {
  return left === right;
}

function thresholdMatches(
  missionMetric: OutcomeMetric,
  qualificationMetric: QualificationMetric,
): boolean {
  if (qualificationMetric.direction !== missionDirection(missionMetric)) return false;
  if ((qualificationMetric.unit ?? "") !== (missionMetric.unit ?? "")) return false;
  if (missionMetric.comparator === "range") {
    return (
      qualificationMetric.lowerBound === missionMetric.lowerBound &&
      qualificationMetric.upperBound === missionMetric.upperBound &&
      sameScalar(qualificationMetric.baseline, missionMetric.baseline)
    );
  }
  return (
    sameScalar(qualificationMetric.threshold, missionMetric.threshold) &&
    sameScalar(qualificationMetric.baseline, missionMetric.baseline)
  );
}

function buildPullList(result: Omit<QualificationGateResult, "pullList">): string[] {
  const pulls: string[] = [];
  if (result.state === "architecture_not_admitted") {
    pulls.push("Pass the candidate-architecture gate before freezing qualification.");
  }
  if (result.state === "upstream_digest_mismatch") {
    pulls.push("Regenerate or explicitly supersede the qualification contract against the current mission, graph, and architecture digests.");
  }
  for (const id of result.uncoveredMissionMetricIds) {
    pulls.push(`Map mission metric ${id} to an essential qualification metric.`);
  }
  for (const id of result.uncoveredQualificationMetricIds) {
    pulls.push(`Exercise essential qualification metric ${id} in at least one complete scenario.`);
  }
  pulls.push(
    ...result.scenarioMetricFindings,
    ...result.instrumentationFindings,
    ...result.thresholdFindings,
  );
  for (const id of result.missingRiskTestIds) {
    pulls.push(`Add qualification metric ${id} required by an architecture risk.`);
  }
  for (const id of result.missingResidualTestIds) {
    pulls.push(`Add qualification metric ${id} required by a carried residual.`);
  }
  pulls.push(
    ...result.comparatorFindings,
    ...result.accountingFindings,
    ...result.authorizationFindings,
    ...result.acceptanceFindings,
  );
  if (result.state === "contract_not_frozen") {
    pulls.push("Freeze the qualification contract before any build manifest or scored run exists.");
  }
  return dedupe(pulls);
}

export function runQualificationGate(
  contract: QualificationContract,
  outcome: MissionOutcome,
  architecture: CandidateArchitecture,
  architectureGate: ArchitectureGateResult,
  expectedCandidateArchitectureDigest: string,
): QualificationGateResult {
  const essentialMetrics = contract.metrics.filter(
    (metric) => metric.criticality === "essential",
  );

  const uncoveredMissionMetricIds = outcome.successMetrics
    .filter(
      (missionMetric) =>
        !essentialMetrics.some((metric) =>
          metric.missionMetricIds.includes(missionMetric.id),
        ),
    )
    .map((metric) => metric.id);

  const scenarioMetricIds = new Set(
    contract.scenarios.flatMap((scenario) => scenario.metricIds),
  );
  const uncoveredQualificationMetricIds = essentialMetrics
    .filter((metric) => !scenarioMetricIds.has(metric.id))
    .map((metric) => metric.id);

  const scenarioMetricFindings: string[] = [];
  for (const scenario of contract.scenarios) {
    if (Object.keys(scenario.environment).length === 0) {
      scenarioMetricFindings.push(`Scenario ${scenario.id} has no environmental state.`);
    }
    if (scenario.fixtureIds.length === 0) {
      scenarioMetricFindings.push(`Scenario ${scenario.id} has no fixture identifier.`);
    }
    if (
      !scenario.metricIds.some((id) =>
        essentialMetrics.some((metric) => metric.id === id),
      )
    ) {
      scenarioMetricFindings.push(`Scenario ${scenario.id} exercises no essential metric.`);
    }
  }

  const instrumentById = new Map(
    contract.instrumentation.map((instrument) => [instrument.id, instrument]),
  );
  const instrumentationFindings: string[] = [];
  for (const metric of contract.metrics) {
    for (const instrumentId of metric.instrumentationIds) {
      const instrument = instrumentById.get(instrumentId);
      if (!instrument) continue;
      if (!["current", "not_required"].includes(instrument.calibrationState)) {
        instrumentationFindings.push(
          `Instrumentation ${instrumentId} for metric ${metric.id} is not calibration-ready.`,
        );
      }
    }
  }
  for (const scenario of contract.scenarios) {
    const scenarioInstruments = new Set(scenario.instrumentationIds);
    for (const metricId of scenario.metricIds) {
      const metric = contract.metrics.find((candidate) => candidate.id === metricId);
      if (!metric) continue;
      for (const instrumentId of metric.instrumentationIds) {
        if (!scenarioInstruments.has(instrumentId)) {
          instrumentationFindings.push(
            `Scenario ${scenario.id} omits instrumentation ${instrumentId} required by metric ${metricId}.`,
          );
        }
      }
    }
  }

  const thresholdFindings: string[] = [];
  for (const missionMetric of outcome.successMetrics) {
    const mapped = essentialMetrics.filter((metric) =>
      metric.missionMetricIds.includes(missionMetric.id),
    );
    if (mapped.length === 0) continue;
    for (const metric of mapped) {
      if (!thresholdMatches(missionMetric, metric)) {
        thresholdFindings.push(
          `Qualification metric ${metric.id} changes the threshold, unit, direction, or baseline of mission metric ${missionMetric.id}.`,
        );
      }
    }
  }

  const qualificationMetricIds = new Set(
    contract.metrics.map((metric) => metric.id),
  );
  const missingRiskTestIds = dedupe(
    architecture.risks
      .filter((risk) => risk.closureState === "requires_test")
      .flatMap((risk) => risk.qualificationTestIds)
      .filter((id) => !qualificationMetricIds.has(id)),
  );
  const missingResidualTestIds = dedupe(
    architecture.residuals
      .filter((residual) => residual.disposition === "qualify")
      .flatMap((residual) => residual.qualificationTestIds)
      .filter((id) => !qualificationMetricIds.has(id)),
  );

  const comparatorFindings: string[] = [];
  const essentialMetricIds = new Set(essentialMetrics.map((metric) => metric.id));
  const scenarioIds = new Set(contract.scenarios.map((scenario) => scenario.id));
  const requirementComparator = contract.comparators.find(
    (comparator) => comparator.type === "customer_requirement",
  );
  if (!requirementComparator) {
    comparatorFindings.push("No customer-requirement comparator is defined.");
  } else {
    if (
      !["same_fixture", "normalized"].includes(
        requirementComparator.comparability,
      )
    ) {
      comparatorFindings.push(
        "The customer-requirement comparator is not fixture-comparable.",
      );
    }
    for (const metricId of essentialMetricIds) {
      if (!requirementComparator.metricIds.includes(metricId)) {
        comparatorFindings.push(
          `The customer-requirement comparator omits essential metric ${metricId}.`,
        );
      }
    }
    for (const scenarioId of scenarioIds) {
      if (!requirementComparator.scenarioIds.includes(scenarioId)) {
        comparatorFindings.push(
          `The customer-requirement comparator omits scenario ${scenarioId}.`,
        );
      }
    }
  }

  const accountingFindings: string[] = [];
  if (contract.accountingBoundary.currency !== architecture.costEnvelope.currency) {
    accountingFindings.push("Qualification and architecture cost currencies differ.");
  }
  if (
    contract.accountingBoundary.evaluationPeriod !==
    architecture.costEnvelope.evaluationPeriod
  ) {
    accountingFindings.push("Qualification and architecture evaluation periods differ.");
  }
  const architectureCategories = new Set(
    architecture.costEnvelope.lines.map((line) => line.category),
  );
  for (const category of architectureCategories) {
    if (!contract.accountingBoundary.includedCategories.includes(category)) {
      accountingFindings.push(
        `Qualification accounting boundary omits architecture cost category ${category}.`,
      );
    }
  }

  const authorizationById = new Map(
    contract.authorizations.map((authorization) => [
      authorization.id,
      authorization,
    ]),
  );
  const authorizationFindings: string[] = [];
  for (const scenario of contract.scenarios) {
    const requiresAuthorization =
      scenario.activeEffect ||
      ["controlled_field", "operational"].includes(scenario.venueClass);
    const authorization = scenario.authorizationId
      ? authorizationById.get(scenario.authorizationId)
      : undefined;
    if (requiresAuthorization && authorization?.state !== "admitted") {
      authorizationFindings.push(
        `Scenario ${scenario.id} requires an admitted venue authorization.`,
      );
    }
    if (
      authorization &&
      authorization.venueClass !== scenario.venueClass
    ) {
      authorizationFindings.push(
        `Scenario ${scenario.id} and authorization ${authorization.id} use different venue classes.`,
      );
    }
    if (
      authorization?.state === "admitted" &&
      authorization.abortAuthority.length === 0
    ) {
      authorizationFindings.push(
        `Authorization ${authorization.id} has no abort authority.`,
      );
    }
  }

  const acceptanceFindings: string[] = [];
  if (!contract.acceptanceRule.allEssentialMustPass) {
    acceptanceFindings.push("Essential metrics are not configured as non-compensatory gates.");
  }
  if (contract.acceptanceRule.allowInconclusiveEssential) {
    acceptanceFindings.push("The contract permits inconclusive essential metrics to pass.");
  }
  if (contract.acceptanceRule.secondaryMetricsCanOffsetEssentialFailure) {
    acceptanceFindings.push("Secondary metrics may not offset an essential failure.");
  }
  for (const metric of essentialMetrics) {
    if (
      contract.acceptanceRule.minimumValidRunsPerMetric > metric.requiredRuns
    ) {
      acceptanceFindings.push(
        `Minimum valid runs exceeds required runs for essential metric ${metric.id}.`,
      );
    }
  }

  const state = !architectureGate.passed
    ? "architecture_not_admitted"
    : contract.missionOutcomeDigest !== architecture.missionOutcomeDigest ||
        contract.capabilityGraphDigest !== architecture.capabilityGraphDigest ||
        contract.candidateArchitectureDigest !== expectedCandidateArchitectureDigest
      ? "upstream_digest_mismatch"
      : uncoveredMissionMetricIds.length > 0
        ? "mission_metric_coverage_incomplete"
        : uncoveredQualificationMetricIds.length > 0 ||
            scenarioMetricFindings.length > 0
          ? "scenario_coverage_incomplete"
          : instrumentationFindings.length > 0
            ? "instrumentation_incomplete"
            : thresholdFindings.length > 0
              ? "threshold_or_baseline_mismatch"
              : missingRiskTestIds.length > 0 ||
                  missingResidualTestIds.length > 0
                ? "risk_or_residual_test_missing"
                : comparatorFindings.length > 0
                  ? "comparator_incomplete"
                  : accountingFindings.length > 0
                    ? "accounting_boundary_mismatch"
                    : authorizationFindings.length > 0
                      ? "authorization_missing"
                      : acceptanceFindings.length > 0
                        ? "acceptance_rule_invalid"
                        : contract.state !== "frozen"
                          ? "contract_not_frozen"
                          : "admitted_for_build_manifest";

  const withoutPulls: Omit<QualificationGateResult, "pullList"> = {
    state,
    passed: state === "admitted_for_build_manifest",
    uncoveredMissionMetricIds,
    uncoveredQualificationMetricIds,
    scenarioMetricFindings: dedupe(scenarioMetricFindings),
    instrumentationFindings: dedupe(instrumentationFindings),
    thresholdFindings: dedupe(thresholdFindings),
    missingRiskTestIds,
    missingResidualTestIds,
    comparatorFindings: dedupe(comparatorFindings),
    accountingFindings: dedupe(accountingFindings),
    authorizationFindings: dedupe(authorizationFindings),
    acceptanceFindings: dedupe(acceptanceFindings),
  };
  return { ...withoutPulls, pullList: buildPullList(withoutPulls) };
}
