import { describe, expect, it } from "vitest";
import fixture from "../../examples/garpa-vendor-parity/parity-case.json";
import type { VendorParityRequest } from "../../app/src/types/garpaParity";
import { validateVendorParityRequest } from "../../app/src/lib/garpa/validateVendorParity";
import { runVendorParityEvaluation } from "../../app/src/lib/garpa/runVendorParityEvaluation";
import { renderVendorParityMarkdown } from "../../app/src/lib/garpa/renderVendorParity";

function request(): VendorParityRequest {
  return structuredClone(fixture) as unknown as VendorParityRequest;
}

describe("GARPA vendor parity validation", () => {
  it("accepts the exact-version synthetic same-fixture request", () => {
    const result = validateVendorParityRequest(fixture);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects a vendor observation from a different offering version", () => {
    const value = request();
    value.observations.find((item) => item.subject === "vendor")!.subjectVersion =
      "different-version";
    const result = validateVendorParityRequest(value);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("does not match the evaluated vendor version");
  });

  it("rejects a GARPA observation from a different build receipt", () => {
    const value = request();
    value.observations.find((item) => item.subject === "garpa")!.buildReceiptDigest =
      "different-build";
    const result = validateVendorParityRequest(value);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("wrong build receipt");
  });

  it("requires units for numeric parity comparators", () => {
    const value = request();
    value.comparators.find((item) => item.metricId === "m-latency-ms")!.requiredUnit =
      undefined;
    const result = validateVendorParityRequest(value);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("require a unit");
  });
});

describe("GARPA vendor parity evaluator", () => {
  it("returns a same-fixture match for the synthetic reference fixture", () => {
    const result = runVendorParityEvaluation(request());
    expect(result.state).toBe("same_fixture_match");
    expect(result.matchedMetricIds).toEqual(["m-detection", "m-latency-ms"]);
    expect(result.missedMetricIds).toEqual([]);
    expect(result.unsupportedParityClaims.join(" ")).toContain(
      "does not establish full-mission",
    );
  });

  it("fails parity when one required essential metric misses", () => {
    const value = request();
    value.observations.find((item) => item.id === "garpa-latency-1")!.value = 1600;
    const result = runVendorParityEvaluation(value);
    expect(result.state).toBe("same_fixture_miss");
    expect(result.missedMetricIds).toContain("m-latency-ms");
    expect(result.largestGap).toContain("Median operator-presentation latency");
  });

  it("keeps claimant-controlled vendor results in evidence-only state", () => {
    const value = request();
    for (const observation of value.observations.filter(
      (item) => item.subject === "vendor",
    )) {
      observation.evidenceControl = "claimant_controlled";
    }
    const result = runVendorParityEvaluation(value);
    expect(result.state).toBe("evidence_only_comparison");
    expect(result.matchedMetricIds).toEqual([]);
  });

  it("returns vendor-baseline-missing when no exact vendor version exists", () => {
    const value = request();
    value.vendorVersion = undefined;
    const result = runVendorParityEvaluation(value);
    expect(result.state).toBe("vendor_baseline_missing");
  });

  it("returns scenario mismatch when there is no same-fixture comparison", () => {
    const value = request();
    value.scenarioComparisons[0]!.state = "normalized";
    value.scenarioComparisons[0]!.normalizationMethod =
      "Normalize published timing to a common clock basis.";
    const result = runVendorParityEvaluation(value);
    expect(result.state).toBe("scenario_mismatch");
  });

  it("blocks a cost parity claim when accounting boundaries are misaligned", () => {
    const value = request();
    value.requiredMetricIds.push("m-first-year-cost");
    value.essentialMetricIds.push("m-first-year-cost");
    value.comparators.push({
      metricId: "m-first-year-cost",
      label: "First-year mission cost",
      essential: true,
      direction: "lower_is_better",
      requiredUnit: "USD",
      absoluteTolerance: 0,
      relativeTolerance: 0,
      requiresAccountingAlignment: true,
    });
    value.observations.push(
      {
        id: "garpa-cost-1",
        subject: "garpa",
        metricId: "m-first-year-cost",
        scenarioId: "garpa-scenario-1",
        fixtureDigest: "shared-fixture-digest-1",
        methodDigest: "shared-method-digest-1",
        buildReceiptDigest: "build-receipt-digest-1",
        qualificationContractDigest: "qualification-digest-1",
        value: 1000,
        unit: "USD",
        evidenceControl: "local_measured",
        evidenceArtifactIds: ["garpa-cost-ledger-1"],
        limitations: [],
      },
      {
        id: "vendor-cost-1",
        subject: "vendor",
        subjectVersion: "reference-1.0.0",
        metricId: "m-first-year-cost",
        scenarioId: "vendor-scenario-1",
        fixtureDigest: "shared-fixture-digest-1",
        methodDigest: "shared-method-digest-1",
        value: 2000,
        unit: "USD",
        evidenceControl: "independent",
        evidenceArtifactIds: ["vendor-cost-ledger-1"],
        limitations: [],
      },
    );
    value.accountingBoundaries = [
      {
        id: "garpa-boundary-1",
        subject: "garpa",
        currency: "USD",
        priceDate: "2026-08-22",
        evaluationPeriod: "first year",
        includes: ["hardware", "integration_labor"],
        exclusions: ["operator labor"],
        missionDenominator: "one protected site-year",
        evidenceArtifactIds: ["garpa-cost-ledger-1"],
      },
      {
        id: "vendor-boundary-1",
        subject: "vendor",
        currency: "USD",
        priceDate: "2026-08-22",
        evaluationPeriod: "first year",
        includes: ["hardware", "operator_labor", "maintenance"],
        exclusions: [],
        missionDenominator: "one protected site-year",
        evidenceArtifactIds: ["vendor-cost-ledger-1"],
      },
    ];
    value.accountingComparison = {
      garpaBoundaryId: "garpa-boundary-1",
      vendorBoundaryId: "vendor-boundary-1",
      state: "misaligned",
      reasons: ["GARPA excludes operator labor while the vendor boundary includes it."],
    };

    const result = runVendorParityEvaluation(value);
    expect(result.state).toBe("accounting_boundary_mismatch");
    expect(result.matchedMetricIds).toEqual([]);
  });

  it("does not attempt parity before GARPA has a matched mission result", () => {
    const value = request();
    value.garpaMissionState = "partial";
    const result = runVendorParityEvaluation(value);
    expect(result.state).toBe("not_attempted");
  });
});

describe("GARPA vendor parity renderer", () => {
  it("renders the exact version, matched metrics, and scope boundary", () => {
    const evaluation = runVendorParityEvaluation(request());
    const markdown = renderVendorParityMarkdown(evaluation);
    expect(markdown).toContain("# GARPA Vendor Parity Evaluation — GARPA-PARITY-0001");
    expect(markdown).toContain("Vendor version: reference-1.0.0");
    expect(markdown).toContain("Parity state: same_fixture_match");
    expect(markdown).toContain("Detection before boundary crossing: match");
    expect(markdown).toContain("full-mission or unrestricted product-level equivalence");
    expect(markdown).toContain("## Falsification line");
  });
});
