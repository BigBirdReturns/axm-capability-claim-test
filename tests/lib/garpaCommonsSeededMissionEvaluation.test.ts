import { describe, expect, it } from "vitest";
import { canonicalStringify } from "../../app/src/lib/garpa/canonicalJson";
import { computeCommonsSeededMissionEvaluationEnvelopeDigest } from "../../app/src/lib/garpa/commonsSeededMissionEvaluationDigest";
import {
  computeCommonsSeededTestRunEnvelopeDigest,
  computeCommonsSeededTestRunReceiptDigest,
} from "../../app/src/lib/garpa/commonsSeededTestRunDigest";
import { renderCommonsSeededMissionEvaluationMarkdown } from "../../app/src/lib/garpa/renderCommonsSeededMissionEvaluation";
import { runCommonsSeededMissionEvaluationGate } from "../../app/src/lib/garpa/runCommonsSeededMissionEvaluationGate";
import { runCommonsSeededTestRunGate } from "../../app/src/lib/garpa/runCommonsSeededTestRunGate";
import { sha256Hex } from "../../app/src/lib/garpa/sha256";
import { validateCommonsSeededMissionEvaluationRequest } from "../../app/src/lib/garpa/validateCommonsSeededMissionEvaluation";
import { buildCommonsSeededMissionEvaluationRequest } from "../fixtures/garpaCommonsSeededMissionEvaluationFixture";

function refreshEnvelope(
  request: ReturnType<typeof buildCommonsSeededMissionEvaluationRequest>,
): void {
  request.evaluationEnvelope.envelopeDigest =
    computeCommonsSeededMissionEvaluationEnvelopeDigest(
      request.evaluationEnvelope,
    );
}

describe("GARPA Commons-seeded mission-evaluation validation", () => {
  it("accepts the complete digest-bound evaluation request", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    const result = validateCommonsSeededMissionEvaluationRequest(request);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects duplicate run bindings", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    request.evaluationEnvelope.runBindings.push(
      structuredClone(request.evaluationEnvelope.runBindings[0]!),
    );
    refreshEnvelope(request);
    const result = validateCommonsSeededMissionEvaluationRequest(request);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("duplicate run id");
  });
});

describe("GARPA Commons-seeded mission-evaluation gate", () => {
  it("admits the complete target run set and delegates the conclusion", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    const result = runCommonsSeededMissionEvaluationGate(request);
    expect(result.passed, JSON.stringify(result)).toBe(true);
    expect(result.state).toBe("seeded_mission_evaluation_admitted");
    expect(result.missionState).toMatch(
      /matched|bounded_match|partial|failed|incomparable|unassessed/,
    );
    expect(result.custodiedMissionEvaluationResult).toBeDefined();
    expect(result.custodiedMissionEvaluationResultDigest).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(result.admittedRunIds.length).toBe(
      request.testRunRequests.length,
    );
  });

  it("blocks a changed envelope after digest freeze", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    request.evaluationEnvelope.evaluationId = "changed-evaluation";
    const result = runCommonsSeededMissionEvaluationGate(request);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "evaluation_envelope_digest_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a forged test-run result binding", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    request.evaluationEnvelope.runBindings[0]!.expectedTestRunResultDigest =
      "a".repeat(64);
    refreshEnvelope(request);
    const result = runCommonsSeededMissionEvaluationGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "run_binding_mismatch",
      ),
    ).toBe(true);
  });

  it("refuses omission of a governed run from delegated evaluation", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    request.custodiedMissionEvaluationArgs = [];
    const validation = validateCommonsSeededMissionEvaluationRequest(request);
    expect(validation.ok).toBe(false);
  });

  it("refuses an extra ungoverned run in delegated evaluation", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    const extra = structuredClone(
      runCommonsSeededTestRunGate(request.testRunRequests[0]!)
        .testRunReceipt!,
    );
    extra.runId = "UNBOUND-RUN";
    request.custodiedMissionEvaluationArgs.push(extra);
    const result = runCommonsSeededMissionEvaluationGate(request);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "unbound_run_in_custodied_evaluation",
      ),
    ).toBe(true);
  });

  it("preserves a failed essential metric rather than laundering it", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    const runRequest = request.testRunRequests[0]!;
    runRequest.testRunReceipt.metricResults[0]!.thresholdResult = "fail";
    runRequest.testRunReceipt.resultDigest =
      computeCommonsSeededTestRunReceiptDigest(runRequest.testRunReceipt);
    const envelope =
      runRequest.executionEnvelope as unknown as Record<string, unknown>;
    if ("testRunReceiptDigest" in envelope) {
      envelope.testRunReceiptDigest = runRequest.testRunReceipt.resultDigest;
    }
    envelope.envelopeDigest =
      computeCommonsSeededTestRunEnvelopeDigest(envelope as never);
    const runResult = runCommonsSeededTestRunGate(runRequest);
    request.evaluationEnvelope.runBindings[0]!.expectedTestRunResultDigest =
      sha256Hex(canonicalStringify(runResult));
    request.evaluationEnvelope.runBindings[0]!.expectedTestRunReceiptDigest =
      runRequest.testRunReceipt.resultDigest;
    refreshEnvelope(request);
    const result = runCommonsSeededMissionEvaluationGate(request);
    expect(result.failedMetricIds).toContain(
      runRequest.testRunReceipt.metricResults[0]!.metricId,
    );
  });

  it("keeps incomplete run coverage out of an admitted final evaluation", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    if (request.testRunRequests.length > 1) {
      const removed = request.testRunRequests.pop()!;
      const runId = removed.testRunReceipt.runId;
      request.evaluationEnvelope.runBindings =
        request.evaluationEnvelope.runBindings.filter(
          (binding) => binding.runId !== runId,
        );
      refreshEnvelope(request);
      const result = runCommonsSeededMissionEvaluationGate(request);
      expect(result.passed).toBe(false);
      expect(
        result.findings.some(
          (finding) =>
            finding.state === "run_set_incomplete" ||
            finding.state === "unbound_run_in_custodied_evaluation",
        ),
      ).toBe(true);
    }
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
    refreshEnvelope(request);
    const result = runCommonsSeededMissionEvaluationGate(request);
    expect(result.state).toBe("seeded_mission_evaluation_blocked");
  });

  it("renders run dispositions and the downstream boundary", () => {
    const request = buildCommonsSeededMissionEvaluationRequest();
    const result = runCommonsSeededMissionEvaluationGate(request);
    const markdown = renderCommonsSeededMissionEvaluationMarkdown(
      request,
      result,
    );
    expect(markdown).toContain(
      "# GARPA Commons-Seeded Mission Evaluation",
    );
    expect(markdown).toContain("Mission state:");
    expect(markdown).toContain("does not establish vendor parity");
  });
});
