import type {
  CommonsSeededMissionEvaluationRequest,
} from "../../app/src/types/garpaCommonsSeededMissionEvaluation";
import type { TestRunReceipt } from "../../app/src/types/garpaExecution";
import { canonicalStringify } from "../../app/src/lib/garpa/canonicalJson";
import {
  computeCommonsSeededMissionEvaluationEnvelopeDigest,
} from "../../app/src/lib/garpa/commonsSeededMissionEvaluationDigest";
import {
  computeCommonsSeededPreflightReceiptDigest,
  computeCommonsSeededPreflightResultDigest,
} from "../../app/src/lib/garpa/commonsSeededPreflightDigest";
import {
  computeCommonsSeededTestRunEnvelopeDigest,
  computeCommonsSeededTestRunReceiptDigest,
} from "../../app/src/lib/garpa/commonsSeededTestRunDigest";
import { runCommonsSeededPreflightGate } from "../../app/src/lib/garpa/runCommonsSeededPreflightGate";
import { runCommonsSeededTestRunGate } from "../../app/src/lib/garpa/runCommonsSeededTestRunGate";
import { sha256Hex } from "../../app/src/lib/garpa/sha256";
import { buildCommonsSeededTestRunRequest } from "./garpaCommonsSeededTestRunFixture";
import { buildCustodiedMissionEvaluationRequest } from "./garpaCustodiedMissionEvaluationFixture";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRun(value: unknown): value is TestRunReceipt {
  return (
    isRecord(value) &&
    typeof value.runId === "string" &&
    typeof value.scenarioId === "string" &&
    Array.isArray(value.metricResults) &&
    typeof value.resultDigest === "string"
  );
}

function findPreflightReceipt(root: unknown): RecordValue {
  const seen = new Set<unknown>();
  function walk(value: unknown): RecordValue | undefined {
    if (!value || typeof value !== "object" || seen.has(value)) return undefined;
    seen.add(value);
    if (
      isRecord(value) &&
      Array.isArray(value.runReservations) &&
      isRecord(value.clockCheck) &&
      typeof value.receiptDigest === "string"
    ) {
      return value;
    }
    for (const child of Array.isArray(value)
      ? value
      : Object.values(value as RecordValue)) {
      const found = walk(child);
      if (found) return found;
    }
    return undefined;
  }
  const found = walk(root);
  if (!found) throw new Error("Preflight receipt not found.");
  return found;
}

function existingEvaluationArgs(): unknown[] {
  return [buildCustodiedMissionEvaluationRequest()];
}

function collectRuns(root: unknown): TestRunReceipt[] {
  const found: TestRunReceipt[] = [];
  const seen = new Set<unknown>();
  function walk(value: unknown): void {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (isRun(value)) {
      found.push(value);
      return;
    }
    if (Array.isArray(value)) value.forEach(walk);
    else Object.values(value as RecordValue).forEach(walk);
  }
  walk(root);
  return found;
}

function replaceRuns(root: unknown, replacements: TestRunReceipt[]): unknown {
  const copy = structuredClone(root);
  let index = 0;
  const seen = new Set<unknown>();
  function walk(
    value: unknown,
    parent?: unknown,
    key?: string | number,
  ): void {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (isRun(value)) {
      if (index >= replacements.length) {
        throw new Error("Insufficient replacement run receipts.");
      }
      if (Array.isArray(parent)) {
        parent[key as number] = structuredClone(replacements[index]!);
      } else if (isRecord(parent)) {
        parent[String(key)] = structuredClone(replacements[index]!);
      }
      index += 1;
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((child, childIndex) => walk(child, value, childIndex));
    } else {
      Object.entries(value as RecordValue).forEach(([childKey, child]) =>
        walk(child, value, childKey),
      );
    }
  }
  const holder: RecordValue = { value: copy };
  walk(copy, holder, "value");
  if (index !== replacements.length) {
    throw new Error(
      `Expected ${replacements.length} run replacements, found ${index}.`,
    );
  }
  return holder.value;
}

function after(value: string, seconds: number): string {
  return new Date(Date.parse(value) + seconds * 1000).toISOString();
}

function buildDistinctTestRun(index: number) {
  const request = structuredClone(
    buildCommonsSeededTestRunRequest(),
  ) as ReturnType<typeof buildCommonsSeededTestRunRequest>;
  const preflightReceipt = findPreflightReceipt(request.preflightRequest);
  const reservation = (preflightReceipt.runReservations as RecordValue[])[0]!;
  const runId = `GARPA-COMMONS-EVAL-RUN-${String(index + 1).padStart(3, "0")}`;
  reservation.runId = runId;
  reservation.reservationReceiptId = `reservation-eval-${index + 1}`;
  reservation.reservedAt = after(
    request.preflightRequest.seededBuildReceiptRequest.asBuiltReceipt.completedAt,
    600 + index,
  );
  reservation.uniquenessEvidenceIds = [
    ...(reservation.uniquenessEvidenceIds as string[]),
  ];
  preflightReceipt.receiptDigest =
    computeCommonsSeededPreflightReceiptDigest(preflightReceipt as never);

  const preflightResult = runCommonsSeededPreflightGate(
    request.preflightRequest,
  );
  if (!preflightResult.passed) throw new Error(JSON.stringify(preflightResult));
  const preflightResultDigest =
    computeCommonsSeededPreflightResultDigest(preflightResult);
  request.expectedPreflightResultDigest = preflightResultDigest;

  const receipt = request.testRunReceipt;
  receipt.runId = runId;
  receipt.scenarioId = String(reservation.scenarioId);
  receipt.testId = `test-eval-${index + 1}`;
  receipt.startedAt = after(String(preflightReceipt.preflightAt), 60 + index * 20);
  receipt.endedAt = after(receipt.startedAt, 10);
  receipt.resultDigest = computeCommonsSeededTestRunReceiptDigest(receipt);

  const envelope = request.executionEnvelope as unknown as RecordValue;
  for (const [key, value] of Object.entries({
    preflightResultDigest,
    preflightReceiptDigest: preflightReceipt.receiptDigest,
    runId,
    reservationReceiptId: reservation.reservationReceiptId,
    testRunReceiptDigest: receipt.resultDigest,
  })) {
    if (key in envelope) envelope[key] = value;
  }
  envelope.envelopeDigest =
    computeCommonsSeededTestRunEnvelopeDigest(envelope as never);
  request.admittedAt = after(receipt.endedAt, 60);

  const result = runCommonsSeededTestRunGate(request);
  if (!result.passed || !result.testRunReceipt) {
    throw new Error(JSON.stringify(result));
  }
  return { request, result };
}

export function buildCommonsSeededMissionEvaluationRequest(): CommonsSeededMissionEvaluationRequest {
  const originalArgs = existingEvaluationArgs();
  const requiredRunCount = collectRuns(originalArgs).length;
  if (requiredRunCount < 1) {
    throw new Error(
      "Existing custodied evaluation fixture contains no test-run receipts.",
    );
  }
  const runs = Array.from({ length: requiredRunCount }, (_, index) =>
    buildDistinctTestRun(index),
  );
  const testRunReceipts = runs.map((item) => item.result.testRunReceipt!);
  const custodiedMissionEvaluationArgs = replaceRuns(
    originalArgs,
    testRunReceipts,
  ) as unknown[];
  const firstRequest = runs[0]!.request;
  const firstReceipt = runs[0]!.result.testRunReceipt!;
  const executionEnvelope =
    firstRequest.executionEnvelope as unknown as RecordValue;
  const evaluatedAt = after(
    runs[runs.length - 1]!.result.testRunReceipt!.endedAt,
    60,
  );
  const envelope: CommonsSeededMissionEvaluationRequest["evaluationEnvelope"] = {
    schemaVersion: 1,
    evaluationId: "mission-evaluation:GARPA-COMMONS-TARGET-0001:v1",
    caseId: firstReceipt.caseId,
    qualificationContractDigest: firstReceipt.qualificationContractDigest,
    asBuiltReceiptDigest: String(executionEnvelope.asBuiltReceiptDigest ?? ""),
    preflightReceiptDigest: String(
      executionEnvelope.preflightReceiptDigest ?? "",
    ),
    runBindings: runs.map((item) => ({
      runId: item.result.testRunReceipt!.runId,
      expectedTestRunResultDigest: sha256Hex(
        canonicalStringify(item.result),
      ),
      expectedTestRunReceiptDigest: item.result.testRunReceipt!.resultDigest,
      scenarioId: item.result.testRunReceipt!.scenarioId,
    })),
    evaluatedAt,
    qualificationTransferred: false,
    missionEquivalenceClaimed: false,
    envelopeDigest: "0".repeat(64),
  };
  envelope.envelopeDigest =
    computeCommonsSeededMissionEvaluationEnvelopeDigest(envelope);
  return {
    schemaVersion: 1,
    testRunRequests: runs.map((item) => item.request),
    custodiedMissionEvaluationArgs,
    evaluationEnvelope: envelope,
    admittedAt: after(evaluatedAt, 60),
  };
}
