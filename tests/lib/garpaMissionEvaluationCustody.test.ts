import { describe, expect, it } from "vitest";
import preflightReceiptRaw from "../../examples/garpa-synthetic-observation/preflight-receipt.json";
import testRunReceiptRaw from "../../examples/garpa-synthetic-observation/test-run-receipt.json";
import type { MissionEvaluationScope } from "../../app/src/types/garpaEvaluation";
import type { PreflightReceipt } from "../../app/src/types/garpaPreflight";
import type { TestRunReceipt } from "../../app/src/types/garpaExecution";
import { validatePreflightReceipt } from "../../app/src/lib/garpa/validatePreflightReceipt";
import { validateTestRunReceipt } from "../../app/src/lib/garpa/validateExecutionReceipts";
import { evaluateMissionAdequacyWithCustody } from "../../app/src/lib/garpa/evaluateMissionAdequacyWithCustody";

function validRun(): TestRunReceipt {
  const result = validateTestRunReceipt(testRunReceiptRaw);
  expect(result.ok, result.errors.join("; ")).toBe(true);
  return result.value!;
}

function validPreflight(): PreflightReceipt {
  const result = validatePreflightReceipt(preflightReceiptRaw);
  expect(result.ok, result.errors.join("; ")).toBe(true);
  return result.value!;
}

const scope: MissionEvaluationScope = {
  caseId: "GARPA-SYNTH-OBS-001",
  qualificationContractDigest: "qualification:synthetic-observation:v1",
  buildDigest: "build:synthetic-observation:v1",
  requiredScenarioIds: ["scenario-controlled-entry"],
  essentialMetricIds: ["metric-detect-before-boundary"],
  secondaryMetricIds: [],
  fullMissionBoundary: false,
  boundaryDescription: "Controlled observation and simulated response only.",
};

describe("GARPA custodied mission evaluation", () => {
  it("admits a run only when a matching passing preflight receipt exists", () => {
    const result = evaluateMissionAdequacyWithCustody({
      scope,
      testRunReceipts: [validRun()],
      preflightReceipts: [validPreflight()],
    });
    expect(result.state).toBe("bounded_match");
    expect(result.admittedRunIds).toEqual(["RUN-001"]);
    expect(result.excludedRunIds).toEqual([]);
  });

  it("returns incomparable when a run has no preflight receipt", () => {
    const result = evaluateMissionAdequacyWithCustody({
      scope,
      testRunReceipts: [validRun()],
      preflightReceipts: [],
    });
    expect(result.state).toBe("incomparable");
    expect(result.admittedRunIds).toEqual([]);
    expect(result.excludedRunIds).toContain("RUN-001");
    expect(result.incomparableDimensions.join(" ")).toContain("no preflight receipt");
  });

  it("excludes a run whose preflight identity does not match", () => {
    const preflight = validPreflight();
    preflight.buildDigest = "build:other";
    const result = evaluateMissionAdequacyWithCustody({
      scope,
      testRunReceipts: [validRun()],
      preflightReceipts: [preflight],
    });
    expect(result.state).toBe("incomparable");
    expect(result.excludedRunIds).toContain("RUN-001");
    expect(result.incomparableDimensions.join(" ")).toContain(
      "different build digests",
    );
  });

  it("excludes a run whose recorded preflight did not pass", () => {
    const preflight = validPreflight();
    preflight.gate = {
      ...preflight.gate,
      passed: false,
      blockingReasons: ["required venue or test authority is absent"],
    };
    const result = evaluateMissionAdequacyWithCustody({
      scope,
      testRunReceipts: [validRun()],
      preflightReceipts: [preflight],
    });
    expect(result.state).toBe("incomparable");
    expect(result.incomparableDimensions.join(" ")).toContain(
      "recorded preflight gate did not pass",
    );
  });
});
