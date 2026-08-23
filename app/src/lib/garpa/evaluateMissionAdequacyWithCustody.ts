import type { MissionEvaluation, MissionEvaluationScope } from "../../types/garpaEvaluation";
import type { TestRunReceipt } from "../../types/garpaExecution";
import type { PreflightReceipt } from "../../types/garpaPreflight";
import { evaluateMissionAdequacy } from "./evaluateMissionAdequacy";
import { runReceiptCustodyGate } from "./runReceiptCustodyGate";

export interface CustodiedMissionEvaluationInput {
  scope: MissionEvaluationScope;
  testRunReceipts: TestRunReceipt[];
  preflightReceipts: PreflightReceipt[];
}

export function evaluateMissionAdequacyWithCustody(
  input: CustodiedMissionEvaluationInput,
): MissionEvaluation {
  const preflightByRun = new Map(
    input.preflightReceipts.map((receipt) => [receipt.runId, receipt]),
  );
  const admittedRuns: TestRunReceipt[] = [];
  const custodyExclusions: string[] = [];
  const custodyDimensions: string[] = [];

  for (const run of input.testRunReceipts) {
    const preflight = preflightByRun.get(run.runId);
    if (!preflight) {
      custodyExclusions.push(run.runId);
      custodyDimensions.push(`Run ${run.runId} has no preflight receipt.`);
      continue;
    }
    const custody = runReceiptCustodyGate({
      preflightReceipt: preflight,
      testRunReceipt: run,
    });
    if (!custody.passed) {
      custodyExclusions.push(run.runId);
      custodyDimensions.push(
        ...custody.blockingReasons.map((reason) => `Run ${run.runId}: ${reason}.`),
      );
      continue;
    }
    admittedRuns.push(run);
  }

  const evaluation = evaluateMissionAdequacy({
    scope: input.scope,
    testRunReceipts: admittedRuns,
  });
  const excludedRunIds = Array.from(
    new Set([...evaluation.excludedRunIds, ...custodyExclusions]),
  );
  const incomparableDimensions = Array.from(
    new Set([...evaluation.incomparableDimensions, ...custodyDimensions]),
  );

  let state = evaluation.state;
  if (admittedRuns.length === 0 && input.testRunReceipts.length > 0) {
    state = "incomparable";
  }

  return {
    ...evaluation,
    state,
    excludedRunIds,
    incomparableDimensions,
    falsificationLine:
      state === "incomparable"
        ? "Supply a passing preflight receipt recorded before execution for each run, with matching case, run, build, and qualification-contract identities."
        : evaluation.falsificationLine,
  };
}
