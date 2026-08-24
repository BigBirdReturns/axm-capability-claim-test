import type { TestRunReceipt } from "../../app/src/types/garpaExecution";
import type {
  CommonsSeededTestRunEnvelope,
  CommonsSeededTestRunRequest,
} from "../../app/src/types/garpaCommonsSeededTestRun";
import {
  computeCommonsSeededTestRunEnvelopeDigest,
  computeCommonsSeededTestRunReceiptDigest,
  computeSeededExecutionConfigurationDigest,
} from "../../app/src/lib/garpa/commonsSeededTestRunDigest";
import { computeCommonsSeededPreflightResultDigest } from "../../app/src/lib/garpa/commonsSeededPreflightDigest";
import { runCommonsSeededPreflightGate } from "../../app/src/lib/garpa/runCommonsSeededPreflightGate";
import { sha256Hex } from "../../app/src/lib/garpa/sha256";
import { buildSeededPreflightRequest } from "./garpaCommonsSeededPreflightFixture";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function findObject(
  root: unknown,
  predicate: (value: RecordValue) => boolean,
  seen = new Set<unknown>(),
): RecordValue | undefined {
  if (seen.has(root)) return undefined;
  seen.add(root);
  if (isRecord(root)) {
    if (predicate(root)) return root;
    for (const value of Object.values(root)) {
      const found = findObject(value, predicate, seen);
      if (found) return found;
    }
  } else if (Array.isArray(root)) {
    for (const value of root) {
      const found = findObject(value, predicate, seen);
      if (found) return found;
    }
  }
  return undefined;
}

function qualificationContract(request: CommonsSeededTestRunRequest["seededPreflightRequest"]): RecordValue {
  const found = findObject(
    request,
    (value) =>
      Array.isArray(value.scenarios) &&
      Array.isArray(value.metrics) &&
      Array.isArray(value.instrumentation) &&
      isRecord(value.acceptanceRule),
  );
  if (!found) throw new Error("Qualification contract not found in fixture chain.");
  return found;
}

function addMilliseconds(value: string, milliseconds: number): string {
  return new Date(Date.parse(value) + milliseconds).toISOString();
}

function metricValue(metric: RecordValue): string | number | boolean {
  if (metric.direction === "boolean") return Boolean(metric.threshold);
  if (typeof metric.threshold === "number") return metric.threshold;
  return String(metric.threshold ?? "measured");
}

export function refreshSeededTestRunDigests(
  request: CommonsSeededTestRunRequest,
): void {
  request.testRunReceipt.resultDigest =
    computeCommonsSeededTestRunReceiptDigest(request.testRunReceipt);
  request.executionEnvelope.envelopeDigest =
    computeCommonsSeededTestRunEnvelopeDigest(request.executionEnvelope);
}

export function buildSeededTestRunRequest(): CommonsSeededTestRunRequest {
  const preflightRequest = buildSeededPreflightRequest();
  const preflightResult = runCommonsSeededPreflightGate(preflightRequest);
  if (!preflightResult.passed) throw new Error(JSON.stringify(preflightResult));
  const preflightReceipt = preflightRequest.preflightReceipt;
  const asBuilt = preflightRequest.seededBuildReceiptRequest.asBuiltReceipt;
  const reservation = preflightReceipt.runReservations[0];
  if (!reservation) throw new Error("No reserved run in preflight fixture.");
  const contract = qualificationContract(preflightRequest);
  const scenarios = Array.isArray(contract.scenarios)
    ? contract.scenarios.filter(isRecord)
    : [];
  const scenario = scenarios.find(
    (item) => String(item.id) === reservation.scenarioId,
  );
  if (!scenario) throw new Error("Reserved scenario is absent from contract.");
  const metrics = Array.isArray(contract.metrics)
    ? contract.metrics.filter(isRecord)
    : [];
  const scenarioMetricIds = Array.isArray(scenario.metricIds)
    ? scenario.metricIds.map(String)
    : [];

  const rawMetricArtifactIds = scenarioMetricIds.map(
    (metricId) => `artifact:${reservation.runId}:raw:${metricId}`,
  );
  const logArtifactId = `artifact:${reservation.runId}:log`;
  const observationArtifactId = `artifact:${reservation.runId}:observation`;
  const startedAt = addMilliseconds(preflightReceipt.preflightAt, 60_000);
  const endedAt = addMilliseconds(startedAt, 60_000);

  const receipt: TestRunReceipt = {
    schemaVersion: 1,
    caseId: asBuilt.caseId,
    runId: reservation.runId,
    buildDigest: asBuilt.receiptDigest,
    qualificationContractDigest: asBuilt.qualificationContractDigest,
    scenarioId: reservation.scenarioId,
    testId: `test:${reservation.scenarioId}`,
    startedAt,
    endedAt,
    operators: preflightReceipt.operatorChecks
      .filter((item) => item.state === "ready")
      .map((item) => item.actor),
    observers: ["GARPA evidence custodian"],
    configurationDigest: computeSeededExecutionConfigurationDigest(preflightRequest),
    fixtureState: Object.fromEntries(
      preflightReceipt.fixtureChecks.map((item) => [
        item.fixtureId,
        item.configurationDigest,
      ]),
    ),
    environmentObserved: Object.fromEntries(
      Object.entries(isRecord(scenario.environment) ? scenario.environment : {}).map(
        ([key, value]) => [key, String(value)],
      ),
    ),
    rawDataArtifactIds: rawMetricArtifactIds,
    logArtifactIds: [logArtifactId],
    observationArtifactIds: [observationArtifactId],
    metricResults: scenarioMetricIds.map((metricId, index) => {
      const metric = metrics.find((item) => String(item.id) === metricId) ?? {};
      return {
        metricId,
        rawSampleArtifactIds: [rawMetricArtifactIds[index]!],
        calculationMethod: String(metric.measurementMethod ?? "Frozen target calculation"),
        codeDigest: sha256Hex(`calculation:${metricId}:v1`),
        sampleCount: Number(metric.requiredRuns ?? 1),
        excludedSamples: [],
        value: metricValue(metric),
        uncertainty: String(metric.allowedUncertainty ?? "No additional uncertainty stated."),
        thresholdResult: "pass" as const,
        analystNotes: ["Synthetic target receipt for deterministic regression only."],
      };
    }),
    interventions: [],
    anomalies: [],
    aborts: [],
    resultDigest: "0".repeat(64),
    state: "valid",
  };

  const artifactIds = [
    ...rawMetricArtifactIds,
    logArtifactId,
    observationArtifactId,
  ];
  const executedAt = addMilliseconds(endedAt, 1_000);
  const envelope: CommonsSeededTestRunEnvelope = {
    schemaVersion: 1,
    receiptId: `seeded-test-run:${reservation.runId}:v1`,
    caseId: asBuilt.caseId,
    seededPreflightResultDigest:
      computeCommonsSeededPreflightResultDigest(preflightResult),
    preflightReceiptDigest: preflightReceipt.receiptDigest,
    asBuiltReceiptDigest: asBuilt.receiptDigest,
    qualificationContractDigest: asBuilt.qualificationContractDigest,
    runReservationReceiptId: reservation.reservationReceiptId,
    artifacts: artifactIds.map((artifactId) => ({
      artifactId,
      sha256: sha256Hex(`bytes:${artifactId}`),
      mediaType: "application/json",
      path: `runs/${reservation.runId}/${artifactId.replace(/[^a-z0-9]+/gi, "-")}.json`,
      capturedAt: executedAt,
    })),
    executedAt,
    qualificationTransferred: false,
    missionEquivalenceClaimed: false,
    envelopeDigest: "0".repeat(64),
  };

  const request: CommonsSeededTestRunRequest = {
    schemaVersion: 1,
    seededPreflightRequest: preflightRequest,
    expectedSeededPreflightResultDigest:
      computeCommonsSeededPreflightResultDigest(preflightResult),
    testRunReceipt: receipt,
    executionEnvelope: envelope,
    admittedAt: addMilliseconds(executedAt, 1_000),
  };
  refreshSeededTestRunDigests(request);
  return request;
}
