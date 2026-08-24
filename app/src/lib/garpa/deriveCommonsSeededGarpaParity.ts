import type { ParityMetricObservation } from "../../types/garpaParity";
import type { QualificationMetric } from "../../types/garpaQualification";
import type {
  CommonsSeededMissionEvaluationRequest,
  CommonsSeededMissionEvaluationResult,
} from "../../types/garpaCommonsSeededMissionEvaluation";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

export interface CommonsSeededParityDerivationIssue {
  metricId: string;
  scenarioId?: string;
  reason: string;
}

export interface CommonsSeededParityDerivation {
  observations: ParityMetricObservation[];
  issues: CommonsSeededParityDerivationIssue[];
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function qualificationOf(request: CommonsSeededMissionEvaluationRequest) {
  return request.testRunRequests[0]!.seededPreflightRequest
    .seededBuildReceiptRequest.seededBuildManifestRequest
    .seededQualificationRequest.qualificationContract;
}

function asBuiltOf(request: CommonsSeededMissionEvaluationRequest) {
  return request.testRunRequests[0]!.seededPreflightRequest
    .seededBuildReceiptRequest.asBuiltReceipt;
}

function numeric(values: Array<number | string | boolean>): number[] | undefined {
  return values.every((value) => typeof value === "number")
    ? (values as number[])
    : undefined;
}

function aggregate(
  metric: QualificationMetric,
  values: Array<number | string | boolean>,
): { value?: number | string | boolean; reason?: string } {
  if (values.length === 0) return { reason: "No valid measured values exist." };
  if (metric.aggregation === "all_runs") {
    const first = canonicalStringify(values[0]);
    if (!values.every((value) => canonicalStringify(value) === first)) {
      return {
        reason:
          "The all-runs aggregation contains non-identical values and cannot be reduced to one parity observation without changing the frozen method.",
      };
    }
    return { value: values[0] };
  }
  if (metric.aggregation === "proportion") {
    if (values.every((value) => typeof value === "boolean")) {
      return {
        value:
          values.filter((value) => value === true).length / values.length,
      };
    }
    const numbers = numeric(values);
    if (numbers && numbers.every((value) => value >= 0 && value <= 1)) {
      return {
        value: numbers.reduce((sum, value) => sum + value, 0) / numbers.length,
      };
    }
    return { reason: "Proportion aggregation requires boolean or zero-to-one numeric values." };
  }
  const numbers = numeric(values);
  if (!numbers) {
    return { reason: `${metric.aggregation} aggregation requires numeric values.` };
  }
  const ordered = [...numbers].sort((left, right) => left - right);
  if (metric.aggregation === "minimum") return { value: ordered[0]! };
  if (metric.aggregation === "maximum") return { value: ordered[ordered.length - 1]! };
  if (metric.aggregation === "mean") {
    return { value: numbers.reduce((sum, value) => sum + value, 0) / numbers.length };
  }
  if (metric.aggregation === "median") {
    const middle = Math.floor(ordered.length / 2);
    return {
      value:
        ordered.length % 2 === 1
          ? ordered[middle]!
          : (ordered[middle - 1]! + ordered[middle]!) / 2,
    };
  }
  if (metric.aggregation === "percentile") {
    const percentile = metric.aggregationParameter;
    if (
      percentile === undefined ||
      !Number.isFinite(percentile) ||
      percentile <= 0 ||
      percentile > 100
    ) {
      return { reason: "Percentile aggregation requires a parameter greater than zero and no greater than 100." };
    }
    const rank = Math.max(1, Math.ceil((percentile / 100) * ordered.length));
    return { value: ordered[rank - 1]! };
  }
  return { reason: `Unsupported aggregation ${metric.aggregation}.` };
}

function methodDigest(metric: QualificationMetric): string {
  return sha256Hex(
    canonicalStringify({
      metricId: metric.id,
      quantity: metric.quantity,
      unit: metric.unit,
      direction: metric.direction,
      threshold: metric.threshold,
      lowerBound: metric.lowerBound,
      upperBound: metric.upperBound,
      baseline: metric.baseline,
      measurementMethod: metric.measurementMethod,
      instrumentationIds: [...metric.instrumentationIds].sort(),
      samplingMethod: metric.samplingMethod,
      requiredRuns: metric.requiredRuns,
      aggregation: metric.aggregation,
      aggregationParameter: metric.aggregationParameter,
      allowedUncertainty: metric.allowedUncertainty,
      failureCondition: metric.failureCondition,
    }),
  );
}

export function deriveCommonsSeededGarpaParityObservations(
  request: CommonsSeededMissionEvaluationRequest,
  result: CommonsSeededMissionEvaluationResult,
): CommonsSeededParityDerivation {
  const qualification = qualificationOf(request);
  const asBuilt = asBuiltOf(request);
  const validRunIds = new Set(result.validRunIds);
  const validRuns = result.testRunReceipts.filter(
    (receipt) => receipt.state === "valid" && validRunIds.has(receipt.runId),
  );
  const observations: ParityMetricObservation[] = [];
  const issues: CommonsSeededParityDerivationIssue[] = [];

  for (const metric of qualification.metrics) {
    const scenarios = qualification.scenarios.filter((scenario) =>
      scenario.metricIds.includes(metric.id),
    );
    if (scenarios.length !== 1) {
      issues.push({
        metricId: metric.id,
        reason:
          scenarios.length === 0
            ? "The frozen metric is not assigned to a qualification scenario."
            : "Version 1 parity derivation requires each metric to resolve to exactly one frozen scenario.",
      });
      continue;
    }
    const scenario = scenarios[0]!;
    const runs = validRuns.filter((receipt) => receipt.scenarioId === scenario.id);
    const metricResults = runs.flatMap((receipt) =>
      receipt.metricResults
        .filter((candidate) => candidate.metricId === metric.id)
        .map((candidate) => ({ receipt, candidate })),
    );
    if (metricResults.length < metric.requiredRuns) {
      issues.push({
        metricId: metric.id,
        scenarioId: scenario.id,
        reason: `Only ${metricResults.length} valid run values exist; ${metric.requiredRuns} are required.`,
      });
      continue;
    }
    if (
      metricResults.some(
        ({ candidate }) =>
          candidate.value === undefined ||
          candidate.thresholdResult === "inconclusive" ||
          candidate.thresholdResult === "not_measured",
      )
    ) {
      issues.push({
        metricId: metric.id,
        scenarioId: scenario.id,
        reason: "At least one required valid run lacks a conclusive measured value.",
      });
      continue;
    }
    const fixtureStates = runs.map((receipt) => canonicalStringify(receipt.fixtureState));
    if (fixtureStates.some((state) => state !== fixtureStates[0])) {
      issues.push({
        metricId: metric.id,
        scenarioId: scenario.id,
        reason: "The admitted valid runs do not share one exact fixture state.",
      });
      continue;
    }
    const aggregation = aggregate(
      metric,
      metricResults.map(({ candidate }) => candidate.value!),
    );
    if (aggregation.value === undefined) {
      issues.push({
        metricId: metric.id,
        scenarioId: scenario.id,
        reason: aggregation.reason ?? "The frozen aggregation could not be evaluated.",
      });
      continue;
    }
    const fixtureDigest = sha256Hex(
      canonicalStringify({
        scenario,
        fixtureState: runs[0]!.fixtureState,
      }),
    );
    const evidenceArtifactIds = dedupe(
      metricResults.flatMap(({ candidate }) => candidate.rawSampleArtifactIds),
    ).sort();
    if (evidenceArtifactIds.length === 0) {
      issues.push({
        metricId: metric.id,
        scenarioId: scenario.id,
        reason: "The aggregated observation has no raw sample artifact custody.",
      });
      continue;
    }
    observations.push({
      id: `commons-garpa:${scenario.id}:${metric.id}:aggregate:v1`,
      subject: "garpa",
      metricId: metric.id,
      scenarioId: scenario.id,
      fixtureDigest,
      methodDigest: methodDigest(metric),
      buildReceiptDigest: asBuilt.receiptDigest,
      qualificationContractDigest: qualificationOf(request).caseId
        ? asBuilt.qualificationContractDigest
        : asBuilt.qualificationContractDigest,
      value: aggregation.value,
      unit: metric.unit,
      evidenceControl: "local_measured",
      evidenceArtifactIds,
      limitations: dedupe([
        ...metric.limitations,
        ...scenario.excludedConditions,
        ...scenario.assumptions,
        request.missionBoundary.boundaryDescription,
      ]),
    });
  }

  return { observations, issues };
}
