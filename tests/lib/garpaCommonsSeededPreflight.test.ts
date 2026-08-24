import { describe, expect, it } from "vitest";
import { computeCommonsSeededPreflightReceiptDigest } from "../../app/src/lib/garpa/commonsSeededPreflightDigest";
import { renderCommonsSeededPreflightMarkdown } from "../../app/src/lib/garpa/renderCommonsSeededPreflight";
import { runCommonsSeededPreflightGate } from "../../app/src/lib/garpa/runCommonsSeededPreflightGate";
import { validateCommonsSeededPreflightRequest } from "../../app/src/lib/garpa/validateCommonsSeededPreflight";
import { buildSeededPreflightRequest } from "../fixtures/garpaCommonsSeededPreflightFixture";

function refreshReceiptDigest(
  request: ReturnType<typeof buildSeededPreflightRequest>,
): void {
  request.preflightReceipt.receiptDigest =
    computeCommonsSeededPreflightReceiptDigest(request.preflightReceipt);
}

describe("GARPA Commons-seeded preflight validation", () => {
  it("accepts the complete digest-bound preflight request", () => {
    const request = buildSeededPreflightRequest();
    const result = validateCommonsSeededPreflightRequest(request);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects duplicate run identifiers", () => {
    const request = buildSeededPreflightRequest();
    request.preflightReceipt.runReservations.push(
      structuredClone(request.preflightReceipt.runReservations[0]!),
    );
    refreshReceiptDigest(request);
    const result = validateCommonsSeededPreflightRequest(request);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("duplicate id");
  });
});

describe("GARPA Commons-seeded preflight gate", () => {
  it("admits the exact ready target and reserved run for execution", () => {
    const request = buildSeededPreflightRequest();
    const result = runCommonsSeededPreflightGate(request);
    expect(result.passed, JSON.stringify(result)).toBe(true);
    expect(result.state).toBe("seeded_preflight_admitted");
    expect(result.reservedRunIds.length).toBeGreaterThan(0);
    expect(result.readyFixtureIds.length).toBeGreaterThan(0);
    expect(result.readyInstrumentationIds.length).toBeGreaterThan(0);
    expect(result.preflightReceipt?.qualificationTransferred).toBe(false);
    expect(result.preflightReceipt?.missionEquivalenceClaimed).toBe(false);
  });

  it("blocks a forged predecessor result digest", () => {
    const request = buildSeededPreflightRequest();
    request.expectedSeededBuildReceiptResultDigest = "a".repeat(64);
    const result = runCommonsSeededPreflightGate(request);
    expect(result.state).toBe("seeded_preflight_blocked");
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "seeded_build_receipt_result_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a changed preflight receipt after digest freeze", () => {
    const request = buildSeededPreflightRequest();
    request.preflightReceipt.clockCheck.measuredSkew = "99 milliseconds";
    const result = runCommonsSeededPreflightGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "preflight_receipt_digest_mismatch",
      ),
    ).toBe(true);
  });

  it("requires every frozen fixture to be ready with evidence", () => {
    const request = buildSeededPreflightRequest();
    request.preflightReceipt.fixtureChecks[0]!.state = "blocked";
    request.preflightReceipt.fixtureChecks[0]!.evidenceIds = [];
    refreshReceiptDigest(request);
    const result = runCommonsSeededPreflightGate(request);
    expect(result.state).toBe("seeded_preflight_incomplete");
    expect(
      result.findings.some((finding) => finding.state === "fixture_not_ready"),
    ).toBe(true);
  });

  it("refuses instrument version and calibration drift", () => {
    const request = buildSeededPreflightRequest();
    const instrument = request.preflightReceipt.instrumentationChecks[0]!;
    instrument.exactModelOrVersion = "unadmitted-instrument-version";
    instrument.calibrationState = "expired";
    refreshReceiptDigest(request);
    const result = runCommonsSeededPreflightGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "instrumentation_identity_mismatch",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "instrumentation_calibration_invalid",
      ),
    ).toBe(true);
  });

  it("requires writable storage at every frozen instrument path", () => {
    const request = buildSeededPreflightRequest();
    request.preflightReceipt.storageCheck.writable = false;
    request.preflightReceipt.storageCheck.verifiedPaths = [];
    request.preflightReceipt.instrumentationChecks[0]!.storageVerified = false;
    refreshReceiptDigest(request);
    const result = runCommonsSeededPreflightGate(request);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "instrumentation_storage_unverified",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "storage_check_incomplete",
      ),
    ).toBe(true);
  });

  it("requires trained operators to acknowledge the complete role boundary", () => {
    const request = buildSeededPreflightRequest();
    const operator = request.preflightReceipt.operatorChecks[0]!;
    operator.trainingEvidenceIds = [];
    operator.authorityBoundaryAcknowledged = false;
    operator.responsibilitiesAcknowledged = [];
    refreshReceiptDigest(request);
    const result = runCommonsSeededPreflightGate(request);
    expect(
      result.findings.some((finding) => finding.state === "operator_not_ready"),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "operator_scope_mismatch",
      ),
    ).toBe(true);
  });

  it("requires the exact frozen venue-authorization scope", () => {
    const request = buildSeededPreflightRequest();
    const authorization = request.preflightReceipt.authorizationChecks[0]!;
    authorization.state = "missing";
    authorization.permittedActivities = [];
    refreshReceiptDigest(request);
    const result = runCommonsSeededPreflightGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "authorization_not_satisfied",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "authorization_scope_mismatch",
      ),
    ).toBe(true);
  });

  it("refuses an open hazard and incomplete abort path", () => {
    const request = buildSeededPreflightRequest();
    request.preflightReceipt.hazardControls[0]!.state = "open";
    request.preflightReceipt.abortCheck.state = "blocked";
    request.preflightReceipt.abortCheck.evidenceIds = [];
    refreshReceiptDigest(request);
    const result = runCommonsSeededPreflightGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "hazard_control_open",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "abort_check_incomplete",
      ),
    ).toBe(true);
  });

  it("requires the clock policy to cover every frozen instrument", () => {
    const request = buildSeededPreflightRequest();
    request.preflightReceipt.clockCheck.synchronizedInstrumentationIds = [];
    refreshReceiptDigest(request);
    const result = runCommonsSeededPreflightGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "clock_check_incomplete",
      ),
    ).toBe(true);
  });

  it("requires one unique run reservation per frozen scenario", () => {
    const request = buildSeededPreflightRequest();
    request.preflightReceipt.runReservations = [];
    refreshReceiptDigest(request);
    const result = runCommonsSeededPreflightGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "run_reservation_missing",
      ),
    ).toBe(true);
  });

  it("refuses a reservation for an unknown scenario", () => {
    const request = buildSeededPreflightRequest();
    request.preflightReceipt.runReservations[0]!.scenarioId =
      "scenario-not-in-frozen-contract";
    refreshReceiptDigest(request);
    const result = runCommonsSeededPreflightGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "run_reservation_scenario_invalid",
      ),
    ).toBe(true);
  });

  it("requires every readiness assertion to resolve to immutable evidence", () => {
    const request = buildSeededPreflightRequest();
    request.preflightReceipt.fixtureChecks[0]!.evidenceIds = [
      "missing-preflight-evidence",
    ];
    refreshReceiptDigest(request);
    const result = runCommonsSeededPreflightGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "evidence_custody_missing",
      ),
    ).toBe(true);
  });

  it("refuses preflight that predates completed assembly", () => {
    const request = buildSeededPreflightRequest();
    request.preflightReceipt.preflightAt = "2020-01-01T00:00:00.000Z";
    refreshReceiptDigest(request);
    const result = runCommonsSeededPreflightGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "preflight_time_order_invalid",
      ),
    ).toBe(true);
  });

  it("refuses qualification or mission-equivalence transfer", () => {
    const request = buildSeededPreflightRequest();
    (
      request.preflightReceipt as unknown as {
        qualificationTransferred: boolean;
      }
    ).qualificationTransferred = true;
    (
      request.preflightReceipt as unknown as {
        missionEquivalenceClaimed: boolean;
      }
    ).missionEquivalenceClaimed = true;
    refreshReceiptDigest(request);
    const result = runCommonsSeededPreflightGate(request);
    expect(result.state).toBe("seeded_preflight_blocked");
  });

  it("renders readiness custody and the execution boundary", () => {
    const request = buildSeededPreflightRequest();
    const result = runCommonsSeededPreflightGate(request);
    const markdown = renderCommonsSeededPreflightMarkdown(request, result);
    expect(markdown).toContain("# GARPA Commons-Seeded Preflight");
    expect(markdown).toContain("Admitted for reserved target execution: true");
    expect(markdown).toContain(request.preflightReceipt.runReservations[0]!.runId);
    expect(markdown).toContain("does not constitute a test result");
  });
});
