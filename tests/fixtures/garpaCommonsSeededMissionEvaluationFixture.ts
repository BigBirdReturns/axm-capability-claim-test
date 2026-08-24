import type {
  CommonsSeededMissionEvaluationRequest,
  CommonsSeededMissionRunBinding,
} from "../../app/src/types/garpaCommonsSeededMissionEvaluation";
import type { CommonsSeededTestRunRequest } from "../../app/src/types/garpaCommonsSeededTestRun";
import {
  computeCommonsSeededMissionEvaluationEnvelopeDigest,
  computeCommonsSeededMissionRunSetDigest,
} from "../../app/src/lib/garpa/commonsSeededMissionEvaluationDigest";
import {
  computeCommonsSeededPreflightReceiptDigest,
  computeCommonsSeededPreflightResultDigest,
} from "../../app/src/lib/garpa/commonsSeededPreflightDigest";
import {
  computeCommonsSeededTestRunEnvelopeDigest,
  computeCommonsSeededTestRunReceiptDigest,
  computeCommonsSeededTestRunResultDigest,
  computeSeededExecutionConfigurationDigest,
} from "../../app/src/lib/garpa/commonsSeededTestRunDigest";
import { runCommonsSeededPreflightGate } from "../../app/src/lib/garpa/runCommonsSeededPreflightGate";
import { runCommonsSeededTestRunGate } from "../../app/src/lib/garpa/runCommonsSeededTestRunGate";
import { sha256Hex } from "../../app/src/lib/garpa/sha256";
import { buildSeededTestRunRequest } from "./garpaCommonsSeededTestRunFixture";

function addMilliseconds(value: string, milliseconds: number): string {
  return new Date(Date.parse(value) + milliseconds).toISOString();
}

function requirePassed(condition: unknown, detail: unknown): asserts condition {
  if (!condition) throw new Error(JSON.stringify(detail));
}

function buildCampaignPreflight(runCount: number) {
  const template = buildSeededTestRunRequest();
  const preflightRequest = structuredClone(template.seededPreflightRequest);
  const receipt = preflightRequest.preflightReceipt;
  const reservation = receipt.runReservations[0];
  if (!reservation) throw new Error("The seeded preflight fixture has no reservation.");
  receipt.runReservations = Array.from({ length: runCount }, (_, index) => ({
    ...structuredClone(reservation),
    runId: `GARPA-COMMONS-EVAL-RUN-${String(index + 1).padStart(3, "0")}`,
    reservationReceiptId: `reservation:commons-eval:${String(index + 1).padStart(3, "0")}`,
  }));
  receipt.receiptDigest = computeCommonsSeededPreflightReceiptDigest(receipt);
  const result = runCommonsSeededPreflightGate(preflightRequest);
  requirePassed(result.passed, result);
  return { preflightRequest, preflightResult: result, template };
}

function replaceRunId(value: string, oldRunId: string, runId: string): string {
  return value.split(oldRunId).join(runId);
}

function buildCampaignRun(
  index: number,
  campaign: ReturnType<typeof buildCampaignPreflight>,
): CommonsSeededTestRunRequest {
  const request = structuredClone(campaign.template);
  request.seededPreflightRequest = structuredClone(campaign.preflightRequest);
  const reservation =
    request.seededPreflightRequest.preflightReceipt.runReservations[index];
  if (!reservation) throw new Error(`Campaign reservation ${index} is missing.`);

  const preflightResult = runCommonsSeededPreflightGate(
    request.seededPreflightRequest,
  );
  requirePassed(preflightResult.passed, preflightResult);
  const preflightResultDigest =
    computeCommonsSeededPreflightResultDigest(preflightResult);
  request.expectedSeededPreflightResultDigest = preflightResultDigest;

  const receipt = request.testRunReceipt;
  const oldRunId = receipt.runId;
  receipt.runId = reservation.runId;
  receipt.scenarioId = reservation.scenarioId;
  receipt.testId = `test:${reservation.scenarioId}:${String(index + 1).padStart(3, "0")}`;
  receipt.startedAt = addMilliseconds(
    request.seededPreflightRequest.preflightReceipt.preflightAt,
    60_000 + index * 120_000,
  );
  receipt.endedAt = addMilliseconds(receipt.startedAt, 60_000);
  receipt.configurationDigest = computeSeededExecutionConfigurationDigest(
    request.seededPreflightRequest,
  );
  receipt.rawDataArtifactIds = receipt.rawDataArtifactIds.map((artifactId) =>
    replaceRunId(artifactId, oldRunId, receipt.runId),
  );
  receipt.logArtifactIds = receipt.logArtifactIds.map((artifactId) =>
    replaceRunId(artifactId, oldRunId, receipt.runId),
  );
  receipt.observationArtifactIds = receipt.observationArtifactIds.map(
    (artifactId) => replaceRunId(artifactId, oldRunId, receipt.runId),
  );
  receipt.metricResults.forEach((metric) => {
    metric.rawSampleArtifactIds = metric.rawSampleArtifactIds.map((artifactId) =>
      replaceRunId(artifactId, oldRunId, receipt.runId),
    );
  });
  receipt.resultDigest = computeCommonsSeededTestRunReceiptDigest(receipt);

  const executedAt = addMilliseconds(receipt.endedAt, 1_000);
  const envelope = request.executionEnvelope;
  envelope.receiptId = `seeded-test-run:${receipt.runId}:v1`;
  envelope.seededPreflightResultDigest = preflightResultDigest;
  envelope.preflightReceiptDigest =
    request.seededPreflightRequest.preflightReceipt.receiptDigest;
  envelope.asBuiltReceiptDigest =
    request.seededPreflightRequest.seededBuildReceiptRequest.asBuiltReceipt
      .receiptDigest;
  envelope.qualificationContractDigest = receipt.qualificationContractDigest;
  envelope.runReservationReceiptId = reservation.reservationReceiptId;
  envelope.executedAt = executedAt;
  envelope.artifacts = envelope.artifacts.map((artifact) => {
    const artifactId = replaceRunId(artifact.artifactId, oldRunId, receipt.runId);
    return {
      ...artifact,
      artifactId,
      sha256: sha256Hex(`bytes:${artifactId}`),
      path: replaceRunId(artifact.path, oldRunId, receipt.runId),
      capturedAt: executedAt,
    };
  });
  envelope.envelopeDigest = computeCommonsSeededTestRunEnvelopeDigest(envelope);
  request.admittedAt = addMilliseconds(executedAt, 1_000);

  const result = runCommonsSeededTestRunGate(request);
  requirePassed(result.passed, result);
  return request;
}

export function refreshCommonsSeededMissionEvaluationEnvelope(
  request: CommonsSeededMissionEvaluationRequest,
): void {
  request.evaluationEnvelope.runSetDigest =
    computeCommonsSeededMissionRunSetDigest(
      request.evaluationEnvelope.runBindings,
    );
  request.evaluationEnvelope.envelopeDigest =
    computeCommonsSeededMissionEvaluationEnvelopeDigest(
      request.evaluationEnvelope,
    );
}

export function buildCommonsSeededMissionEvaluationRequest(
  runCount = 10,
): CommonsSeededMissionEvaluationRequest {
  const campaign = buildCampaignPreflight(runCount);
  const testRunRequests = Array.from({ length: runCount }, (_, index) =>
    buildCampaignRun(index, campaign),
  );
  const testRunResults = testRunRequests.map((request) => {
    const result = runCommonsSeededTestRunGate(request);
    requirePassed(result.testRunReceipt, result);
    return result;
  });
  const firstRequest = testRunRequests[0];
  const firstResult = testRunResults[0];
  if (!firstRequest || !firstResult?.testRunReceipt) {
    throw new Error("The campaign requires at least one test run.");
  }
  const qualification =
    firstRequest.seededPreflightRequest.seededBuildReceiptRequest
      .seededBuildManifestRequest.seededQualificationRequest.qualificationContract;
  const asBuilt =
    firstRequest.seededPreflightRequest.seededBuildReceiptRequest.asBuiltReceipt;
  const preflight = firstRequest.seededPreflightRequest.preflightReceipt;
  const runBindings: CommonsSeededMissionRunBinding[] = testRunResults.map(
    (result, index) => {
      const request = testRunRequests[index]!;
      const receipt = result.testRunReceipt!;
      const reservation = request.seededPreflightRequest.preflightReceipt
        .runReservations.find((candidate) => candidate.runId === receipt.runId);
      if (!reservation) throw new Error(`Reservation ${receipt.runId} is missing.`);
      return {
        runId: receipt.runId,
        scenarioId: receipt.scenarioId,
        reservationReceiptId: reservation.reservationReceiptId,
        expectedTestRunResultDigest:
          computeCommonsSeededTestRunResultDigest(result),
        expectedTestRunReceiptDigest: receipt.resultDigest,
        expectedSeededPreflightResultDigest:
          result.seededPreflightResultDigest,
        expectedPreflightReceiptDigest: result.preflightReceiptDigest,
        expectedAsBuiltReceiptDigest: asBuilt.receiptDigest,
        expectedQualificationContractDigest:
          receipt.qualificationContractDigest,
      };
    },
  );
  const latestRunEnd = testRunResults.reduce(
    (latest, result) =>
      Date.parse(result.testRunReceipt!.endedAt) > Date.parse(latest)
        ? result.testRunReceipt!.endedAt
        : latest,
    firstResult.testRunReceipt.endedAt,
  );
  const evaluatedAt = addMilliseconds(latestRunEnd, 60_000);
  const request: CommonsSeededMissionEvaluationRequest = {
    schemaVersion: 1,
    testRunRequests,
    missionBoundary: {
      fullMissionBoundary: false,
      boundaryDescription:
        "Controlled indoor single-object target fixture with the frozen target class, isolated network, one trained operator, and no active response or operational deployment.",
    },
    evaluationEnvelope: {
      schemaVersion: 1,
      evaluationId: "mission-evaluation:GARPA-COMMONS-TARGET-0001:v1",
      caseId: firstResult.testRunReceipt.caseId,
      missionOutcomeDigest: qualification.missionOutcomeDigest,
      qualificationContractDigest: asBuilt.qualificationContractDigest,
      asBuiltReceiptDigest: asBuilt.receiptDigest,
      campaignPreflightReceiptDigest: preflight.receiptDigest,
      runSetDigest: computeCommonsSeededMissionRunSetDigest(runBindings),
      runBindings,
      evaluatedAt,
      qualificationTransferred: false,
      missionEquivalenceClaimed: false,
      envelopeDigest: "0".repeat(64),
    },
    admittedAt: addMilliseconds(evaluatedAt, 60_000),
  };
  refreshCommonsSeededMissionEvaluationEnvelope(request);
  return request;
}

export const buildSeededMissionEvaluationRequest =
  buildCommonsSeededMissionEvaluationRequest;
