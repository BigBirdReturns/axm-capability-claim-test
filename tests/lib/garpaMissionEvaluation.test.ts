import { describe, expect, it } from "vitest";
import testRunReceiptRaw from "../../examples/garpa-synthetic-observation/test-run-receipt.json";
import type { MissionEvaluationScope } from "../../app/src/types/garpaEvaluation";
import type { TestRunReceipt } from "../../app/src/types/garpaExecution";
import { validateTestRunReceipt } from "../../app/src/lib/garpa/validateExecutionReceipts";
import { evaluateMissionAdequacy } from "../../app/src/lib/garpa/evaluateMissionAdequacy";

function validRun(): TestRunReceipt {
  const result = validateTestRunReceipt(testRunReceiptRaw);
  expect(result.ok, result.errors.join("; ")).toBe(true);
  return result.value!;
}

function scope(overrides: Partial<MissionEvaluationScope> = {}): MissionEvaluationScope {
  return {
    caseId: "GARPA-SYNTH-OBS-001",
    qualificationContractDigest: "qualification:synthetic-observation:v1",
    buildDigest: "build:synthetic-observation:v1",
    requiredScenarioIds: ["scenario-controlled-entry"],
    essentialMetricIds: ["metric-detect-before-boundary"],
    secondaryMetricIds: [],
    fullMissionBoundary: false,
    boundaryDescription: "Controlled observation and simulated response only.",
    ...overrides,
  };
}

describe("GARPA mission adequacy evaluator", () => {
  it("returns bounded_match when all essential metrics pass inside a narrow boundary", () => {
    const result = evaluateMissionAdequacy({
      scope: scope(),
      testRunReceipts: [validRun()],
    });
    expect(result.state).toBe("bounded_match");
    expect(result.admittedRunIds).toEqual(["RUN-001"]);
    expect(result.essentialMetricResults[0]?.state).toBe("pass");
    expect(result.residuals.join(" ")).toContain("bounded mission slice");
  });

  it("returns matched only when the declared full mission boundary is covered", () => {
    const result = evaluateMissionAdequacy({
      scope: scope({ fullMissionBoundary: true, boundaryDescription: "Full admitted boundary." }),
      testRunReceipts: [validRun()],
    });
    expect(result.state).toBe("matched");
  });

  it("fails when any admitted run fails an essential metric", () => {
    const run = validRun();
    run.runId = "RUN-FAIL";
    run.metricResults[0] = {
      ...run.metricResults[0]!,
      value: false,
      thresholdResult: "fail",
    };
    const result = evaluateMissionAdequacy({
      scope: scope(),
      testRunReceipts: [run],
    });
    expect(result.state).toBe("failed");
    expect(result.failures).toContain(
      "Essential metric metric-detect-before-boundary failed.",
    );
  });

  it("returns partial when a required scenario is absent", () => {
    const result = evaluateMissionAdequacy({
      scope: scope({
        requiredScenarioIds: [
          "scenario-controlled-entry",
          "scenario-degraded-visibility",
        ],
      }),
      testRunReceipts: [validRun()],
    });
    expect(result.state).toBe("partial");
    expect(
      result.scenarioResults.find(
        (scenario) => scenario.scenarioId === "scenario-degraded-visibility",
      )?.state,
    ).toBe("missing");
  });

  it("returns incomparable when every run uses a stale build or qualification contract", () => {
    const run = validRun();
    run.buildDigest = "build:other";
    const result = evaluateMissionAdequacy({
      scope: scope(),
      testRunReceipts: [run],
    });
    expect(result.state).toBe("incomparable");
    expect(result.admittedRunIds).toEqual([]);
    expect(result.incomparableDimensions.join(" ")).toContain("different build digest");
  });

  it("does not let a secondary metric compensate for an essential failure", () => {
    const run = validRun();
    run.metricResults[0] = {
      ...run.metricResults[0]!,
      value: false,
      thresholdResult: "fail",
    };
    run.metricResults.push({
      metricId: "metric-cost",
      rawSampleArtifactIds: ["raw-events-1"],
      calculationMethod: "Read actual cost ledger.",
      sampleCount: 1,
      excludedSamples: [],
      value: 45,
      thresholdResult: "pass",
      analystNotes: [],
    });
    const result = evaluateMissionAdequacy({
      scope: scope({ secondaryMetricIds: ["metric-cost"] }),
      testRunReceipts: [run],
    });
    expect(result.state).toBe("failed");
    expect(result.secondaryMetricResults[0]?.state).toBe("pass");
  });
});
