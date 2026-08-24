import { describe, expect, it } from "vitest";
import {
  computeCommonsSeededTestRunEnvelopeDigest,
  computeCommonsSeededTestRunReceiptDigest,
  computeCommonsSeededTestRunResultDigest,
} from "../../app/src/lib/garpa/commonsSeededTestRunDigest";
import { renderCommonsSeededMissionEvaluationMarkdown } from "../../app/src/lib/garpa/renderCommonsSeededMissionEvaluation";
import { runCommonsSeededMissionEvaluationGate } from "../../app/src/lib/garpa/runCommonsSeededMissionEvaluationGate";
import { runCommonsSeededTestRunGate } from "../../app/src/lib/garpa/runCommonsSeededTestRunGate";
import { validateCommonsSeededMissionEvaluationRequest } from "../../app/src/lib/garpa/validateCommonsSeededMissionEvaluation";
import {
  buildCommonsSeededMissionEvaluationRequest,
  refreshCommonsSeededMissionEvaluationEnvelope,
} from "../fixtures/garpaCommonsSeededMissionEvaluationFixture";

function refreshBoundRun(
  request: ReturnType<typeof buildCommonsSeededMissionEvaluationRequest>,
  index: number,
): void {
  const runRequest = request.testRunRequests[index]!;
  runRequest.testRunReceipt.resultDigest =
    computeCommonsSeededTestRunReceiptDigest(runRequest.testRunReceipt);
  runRequest.executionEnvelope.envelopeDigest =
    computeCommonsSeededTestRunEnvelopeDigest(runRequest.executionEnvelope);
  const result = runCommonsSeededTestRunGate(runRequest);
  const binding = request.evaluationEnvelope.runBindings[index]!;
  binding.expectedTestRunResultDigest =
    computeCommonsSeededTestRunResultDigest(result);
  binding.expectedTestRunReceiptDigest = runRequest.testRunReceipt.resultDigest;
  binding.expectedSeededPreflightResultDigest =
    result.seededPreflightResultDigest;
  binding.expectedPreflightReceiptDigest = result.preflightReceiptDigest;
  refreshCommonsSeededMissionEvaluationEnvelope(request);
}

describe("GARPA Commons-seeded mission-evaluation validation", () => {
  it("accepts the complete typed campaign request", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    const result = validateCommonsSeededMissionEvaluationRequest(request);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects duplicate run bindings", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    request.evaluationEnvelope.runBindings.push(
      structuredClone(request.evaluationEnvelope.runBindings[0]!),
    );
    refreshCommonsSeededMissionEvaluationEnvelope(request);
    const result = validateCommonsSeededMissionEvaluationRequest(request);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("duplicate run id");
  });
});

describe("GARPA Commons-seeded mission-evaluation gate", () => {
  it("admits a complete ten-run bounded campaign", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    const result = runCommonsSeededMissionEvaluationGate(request);
    expect(result.passed, JSON.stringify(result)).toBe(true);
    expect(result.state).toBe("seeded_mission_evaluation_admitted");
    expect(result.missionState).toBe("bounded_match");
    expect(result.validRunIds).toHaveLength(10);
    expect(result.submittedRunIds).toEqual(result.retainedRunIds);
    expect(result.scenarioCoverage.every((item) => item.state === "complete")).toBe(
      true,
    );
    expect(result.metricCoverage.every((item) => item.state === "complete")).toBe(
      true,
    );
    expect(result.custodiedMissionEvaluationResultDigest).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it("refuses omission of a reserved execution", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    const removed = request.testRunRequests.pop()!;
    request.evaluationEnvelope.runBindings =
      request.evaluationEnvelope.runBindings.filter(
        (binding) => binding.runId !== removed.testRunReceipt.runId,
      );
    refreshCommonsSeededMissionEvaluationEnvelope(request);
    const result = runCommonsSeededMissionEvaluationGate(request);
    expect(result.passed).toBe(false);
    expect(
      result.findings.some(
        (finding) => finding.state === "reserved_run_omitted",
      ),
    ).toBe(true);
  });

  it("blocks a forged deterministic run-result binding", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    request.evaluationEnvelope.runBindings[0]!.expectedTestRunResultDigest =
      "a".repeat(64);
    refreshCommonsSeededMissionEvaluationEnvelope(request);
    const result = runCommonsSeededMissionEvaluationGate(request);
    expect(result.state).toBe("seeded_mission_evaluation_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "test_run_result_mismatch",
      ),
    ).toBe(true);
  });

  it("admits a complete campaign whose essential metric failed", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    const runRequest = request.testRunRequests[0]!;
    runRequest.testRunReceipt.metricResults[0]!.thresholdResult = "fail";
    refreshBoundRun(request, 0);
    const result = runCommonsSeededMissionEvaluationGate(request);
    expect(result.passed, JSON.stringify(result)).toBe(true);
    expect(result.missionState).toBe("failed");
    expect(result.failedMetricIds).toContain(
      runRequest.testRunReceipt.metricResults[0]!.metricId,
    );
  });

  it("retains a receipted abort while ten other valid runs satisfy coverage", () => {
    const request = buildCommonsSeededMissionEvaluationRequest(11);
    const runRequest = request.testRunRequests[0]!;
    runRequest.testRunReceipt.state = "aborted";
    runRequest.testRunReceipt.aborts = [
      {
        id: "abort:commons-eval:001",
        occurredAt: runRequest.testRunReceipt.endedAt,
        authority: runRequest.testRunReceipt.operators[0]!,
        reason: "Synthetic regression abort retained as campaign evidence.",
      },
    ];
    refreshBoundRun(request, 0);
    const result = runCommonsSeededMissionEvaluationGate(request);
    expect(result.passed, JSON.stringify(result)).toBe(true);
    expect(result.missionState).toBe("bounded_match");
    expect(result.abortedRunIds).toContain(runRequest.testRunReceipt.runId);
    expect(result.excludedRunIds).toContain(runRequest.testRunReceipt.runId);
    expect(result.validRunIds).toHaveLength(10);
  });

  it("retains a receipted invalidation while ten valid runs satisfy coverage", () => {
    const request = buildCommonsSeededMissionEvaluationRequest(11);
    const runRequest = request.testRunRequests[0]!;
    runRequest.testRunReceipt.state = "invalidated";
    runRequest.testRunReceipt.anomalies = [
      {
        id: "anomaly:commons-eval:001",
        occurredAt: runRequest.testRunReceipt.endedAt,
        description: "Synthetic invalidating anomaly retained for regression.",
        affectedMetricIds: runRequest.testRunReceipt.metricResults.map(
          (metric) => metric.metricId,
        ),
        disposition: "invalidates_run",
      },
    ];
    refreshBoundRun(request, 0);
    const result = runCommonsSeededMissionEvaluationGate(request);
    expect(result.passed, JSON.stringify(result)).toBe(true);
    expect(result.invalidatedRunIds).toContain(
      runRequest.testRunReceipt.runId,
    );
    expect(result.excludedRunIds).toContain(runRequest.testRunReceipt.runId);
    expect(result.validRunIds).toHaveLength(10);
  });

  it("refuses a full-mission declaration over frozen exclusions", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    request.missionBoundary.fullMissionBoundary = true;
    const result = runCommonsSeededMissionEvaluationGate(request);
    expect(result.state).toBe("seeded_mission_evaluation_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "mission_boundary_mismatch",
      ),
    ).toBe(true);
  });

  it("refuses qualification or unrestricted equivalence transfer", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    (
      request.evaluationEnvelope as unknown as {
        qualificationTransferred: boolean;
      }
    ).qualificationTransferred = true;
    (
      request.evaluationEnvelope as unknown as {
        missionEquivalenceClaimed: boolean;
      }
    ).missionEquivalenceClaimed = true;
    refreshCommonsSeededMissionEvaluationEnvelope(request);
    const result = runCommonsSeededMissionEvaluationGate(request);
    expect(result.state).toBe("seeded_mission_evaluation_blocked");
  });

  it("renders run dispositions, coverage, and downstream boundary", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    const result = runCommonsSeededMissionEvaluationGate(request);
    const markdown = renderCommonsSeededMissionEvaluationMarkdown(
      request,
      result,
    );
    expect(markdown).toContain(
      "# GARPA Commons-Seeded Mission Evaluation",
    );
    expect(markdown).toContain("Mission state: bounded_match");
    expect(markdown).toContain("Metric coverage");
    expect(markdown).toContain("does not establish vendor parity");
  });
});
