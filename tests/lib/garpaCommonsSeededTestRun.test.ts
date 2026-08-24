import { describe, expect, it } from "vitest";
import {
  buildSeededTestRunRequest,
  refreshSeededTestRunDigests,
} from "../fixtures/garpaCommonsSeededTestRunFixture";
import { renderCommonsSeededTestRunMarkdown } from "../../app/src/lib/garpa/renderCommonsSeededTestRun";
import { runCommonsSeededTestRunGate } from "../../app/src/lib/garpa/runCommonsSeededTestRunGate";
import { validateCommonsSeededTestRunRequest } from "../../app/src/lib/garpa/validateCommonsSeededTestRun";

describe("GARPA Commons-seeded test-run validation", () => {
  it("accepts the complete reserved target run fixture", () => {
    const request = buildSeededTestRunRequest();
    const result = validateCommonsSeededTestRunRequest(request);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects duplicate artifact identities and transfer claims", () => {
    const request = buildSeededTestRunRequest();
    request.executionEnvelope.artifacts.push({
      ...request.executionEnvelope.artifacts[0]!,
    });
    (request.executionEnvelope as unknown as { qualificationTransferred: boolean }).qualificationTransferred = true;
    (request.executionEnvelope as unknown as { missionEquivalenceClaimed: boolean }).missionEquivalenceClaimed = true;
    const result = validateCommonsSeededTestRunRequest(request);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("duplicate id");
    expect(result.errors.join(" ")).toContain("qualificationTransferred");
    expect(result.errors.join(" ")).toContain("missionEquivalenceClaimed");
  });
});

describe("GARPA Commons-seeded test-run gate", () => {
  it("admits a coherent valid receipt without evaluating mission adequacy", () => {
    const request = buildSeededTestRunRequest();
    const result = runCommonsSeededTestRunGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.state).toBe("seeded_test_run_admitted");
    expect(result.testRunState).toBe("valid");
    expect(result.thresholdSummary.failMetricIds).toEqual([]);
    expect(result.prohibitedTransitions.join(" ")).toContain("mission adequacy");
  });

  it("blocks a forged preflight-result digest", () => {
    const request = buildSeededTestRunRequest();
    request.expectedSeededPreflightResultDigest = "a".repeat(64);
    const result = runCommonsSeededTestRunGate(request);
    expect(result.state).toBe("seeded_test_run_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_preflight_result_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks stale run and envelope digests", () => {
    const request = buildSeededTestRunRequest();
    request.testRunReceipt.resultDigest = "b".repeat(64);
    request.executionEnvelope.envelopeDigest = "c".repeat(64);
    const result = runCommonsSeededTestRunGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "test_run_result_digest_mismatch",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "execution_envelope_digest_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks an unreserved run or changed scenario", () => {
    const request = buildSeededTestRunRequest();
    request.testRunReceipt.runId = "RUN-UNRESERVED";
    request.testRunReceipt.scenarioId = "scenario-unreserved";
    refreshSeededTestRunDigests(request);
    const result = runCommonsSeededTestRunGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "run_reservation_missing",
      ),
    ).toBe(true);
  });

  it("blocks as-built and execution-configuration drift", () => {
    const request = buildSeededTestRunRequest();
    request.testRunReceipt.buildDigest = "d".repeat(64);
    request.testRunReceipt.configurationDigest = "e".repeat(64);
    refreshSeededTestRunDigests(request);
    const result = runCommonsSeededTestRunGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "test_run_upstream_digest_mismatch",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "execution_configuration_mismatch",
      ),
    ).toBe(true);
  });

  it("preserves fixture and environment drift as an incomplete run", () => {
    const request = buildSeededTestRunRequest();
    const fixtureId = Object.keys(request.testRunReceipt.fixtureState)[0]!;
    request.testRunReceipt.fixtureState[fixtureId] = "changed";
    const environmentKey = Object.keys(
      request.testRunReceipt.environmentObserved,
    )[0]!;
    request.testRunReceipt.environmentObserved[environmentKey] = "changed";
    refreshSeededTestRunDigests(request);
    const result = runCommonsSeededTestRunGate(request);
    expect(result.state).toBe("seeded_test_run_incomplete");
    expect(
      result.findings.some(
        (finding) => finding.state === "fixture_state_mismatch",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "environment_observation_mismatch",
      ),
    ).toBe(true);
  });

  it("preserves missing metrics and insufficient samples", () => {
    const request = buildSeededTestRunRequest();
    request.testRunReceipt.metricResults.shift();
    request.testRunReceipt.metricResults[0]!.sampleCount = 0;
    refreshSeededTestRunDigests(request);
    const result = runCommonsSeededTestRunGate(request);
    expect(result.state).toBe("seeded_test_run_incomplete");
    expect(
      result.findings.some(
        (finding) => finding.state === "required_metric_missing",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "required_sample_count_incomplete",
      ),
    ).toBe(true);
  });

  it("admits a measured threshold failure as evidence rather than rewriting it", () => {
    const request = buildSeededTestRunRequest();
    request.testRunReceipt.metricResults[0]!.thresholdResult = "fail";
    request.testRunReceipt.metricResults[0]!.analystNotes.push(
      "Frozen threshold failed.",
    );
    refreshSeededTestRunDigests(request);
    const result = runCommonsSeededTestRunGate(request);
    expect(result.passed).toBe(true);
    expect(result.thresholdSummary.failMetricIds).toContain(
      request.testRunReceipt.metricResults[0]!.metricId,
    );
  });

  it("requires content-addressed custody for every raw sample", () => {
    const request = buildSeededTestRunRequest();
    const missing = request.testRunReceipt.rawDataArtifactIds[0]!;
    request.executionEnvelope.artifacts =
      request.executionEnvelope.artifacts.filter(
        (artifact) => artifact.artifactId !== missing,
      );
    refreshSeededTestRunDigests(request);
    const result = runCommonsSeededTestRunGate(request);
    expect(result.state).toBe("seeded_test_run_incomplete");
    expect(
      result.findings.some(
        (finding) => finding.state === "raw_artifact_custody_missing",
      ),
    ).toBe(true);
  });

  it("blocks a valid run that contains an abort receipt", () => {
    const request = buildSeededTestRunRequest();
    request.testRunReceipt.aborts.push({
      id: "abort-1",
      occurredAt: request.testRunReceipt.endedAt,
      authority: "Target operator",
      reason: "Synthetic abort",
    });
    refreshSeededTestRunDigests(request);
    const result = runCommonsSeededTestRunGate(request);
    expect(result.state).toBe("seeded_test_run_incomplete");
    expect(
      result.findings.some(
        (finding) => finding.state === "valid_run_contains_abort",
      ),
    ).toBe(true);
  });

  it("admits an aborted run when the abort receipt is preserved", () => {
    const request = buildSeededTestRunRequest();
    request.testRunReceipt.state = "aborted";
    request.testRunReceipt.aborts.push({
      id: "abort-1",
      occurredAt: request.testRunReceipt.endedAt,
      authority: "Target operator",
      reason: "Synthetic safety abort",
    });
    refreshSeededTestRunDigests(request);
    const result = runCommonsSeededTestRunGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.testRunState).toBe("aborted");
  });

  it("requires an invalidating anomaly for an invalidated run", () => {
    const request = buildSeededTestRunRequest();
    request.testRunReceipt.state = "invalidated";
    refreshSeededTestRunDigests(request);
    const missing = runCommonsSeededTestRunGate(request);
    expect(
      missing.findings.some(
        (finding) =>
          finding.state === "invalidated_run_missing_invalidation_receipt",
      ),
    ).toBe(true);

    request.testRunReceipt.anomalies.push({
      id: "anomaly-1",
      occurredAt: request.testRunReceipt.endedAt,
      description: "Synthetic clock discontinuity",
      affectedMetricIds: request.testRunReceipt.metricResults.map(
        (item) => item.metricId,
      ),
      disposition: "invalidates_run",
    });
    refreshSeededTestRunDigests(request);
    const admitted = runCommonsSeededTestRunGate(request);
    expect(admitted.passed, JSON.stringify(admitted.findings)).toBe(true);
  });

  it("renders receipt state, threshold dispositions, and downstream boundary", () => {
    const request = buildSeededTestRunRequest();
    const result = runCommonsSeededTestRunGate(request);
    const markdown = renderCommonsSeededTestRunMarkdown(request, result);
    expect(markdown).toContain("# GARPA Commons-Seeded Test Run");
    expect(markdown).toContain(request.testRunReceipt.runId);
    expect(markdown).toContain("Threshold dispositions");
    expect(markdown).toContain("mission adequacy");
  });
});
