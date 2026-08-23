import type {
  PreflightReceipt,
  PreflightReceiptInput,
  ReceiptCustodyGateInput,
  ReceiptCustodyGateResult,
} from "../../types/garpaPreflight";
import { runPreflightGate } from "./runPreflightGate";

export function createPreflightReceipt(
  input: PreflightReceiptInput,
): PreflightReceipt {
  const gate = runPreflightGate(input.preflight);
  return {
    schemaVersion: 1,
    caseId: input.caseId,
    runId: input.runId,
    buildId: input.preflight.buildReceipt.buildId,
    buildDigest: input.preflight.buildReceipt.buildDigest,
    manifestDigest: input.preflight.buildReceipt.manifestDigest,
    qualificationContractDigest:
      input.preflight.buildReceipt.qualificationContractDigest,
    readiness: input.preflight.readiness,
    gate,
    evaluatedAt: input.evaluatedAt,
    preflightDigest: input.preflightDigest,
  };
}

export function runReceiptCustodyGate(
  input: ReceiptCustodyGateInput,
): ReceiptCustodyGateResult {
  const { preflightReceipt, testRunReceipt } = input;
  const runIdMatches = preflightReceipt.runId === testRunReceipt.runId;
  const caseIdMatches = preflightReceipt.caseId === testRunReceipt.caseId;
  const buildDigestMatches =
    preflightReceipt.buildDigest === testRunReceipt.buildDigest;
  const qualificationContractDigestMatches =
    preflightReceipt.qualificationContractDigest ===
    testRunReceipt.qualificationContractDigest;
  const preflightPassed = preflightReceipt.gate.passed;
  const preflightPrecedesRun =
    Date.parse(preflightReceipt.evaluatedAt) <= Date.parse(testRunReceipt.startedAt);

  const blockingReasons: string[] = [];
  if (!runIdMatches) blockingReasons.push("preflight and test-run identifiers differ");
  if (!caseIdMatches) blockingReasons.push("preflight and test-run case identifiers differ");
  if (!buildDigestMatches) blockingReasons.push("preflight and test run use different build digests");
  if (!qualificationContractDigestMatches) {
    blockingReasons.push(
      "preflight and test run use different qualification-contract digests",
    );
  }
  if (!preflightPassed) blockingReasons.push("the recorded preflight gate did not pass");
  if (!preflightPrecedesRun) {
    blockingReasons.push("the preflight receipt was recorded after test execution began");
  }

  return {
    passed: blockingReasons.length === 0,
    runIdMatches,
    caseIdMatches,
    buildDigestMatches,
    qualificationContractDigestMatches,
    preflightPassed,
    preflightPrecedesRun,
    blockingReasons,
  };
}
