import { describe, expect, it } from "vitest";
import {
  buildSeededQualificationRequest,
} from "../fixtures/garpaCommonsSeededQualificationFixture";
import { runCommonsSeededQualificationGate } from "../../app/src/lib/garpa/runCommonsSeededQualificationGate";
import { validateCommonsSeededQualificationRequest } from "../../app/src/lib/garpa/validateCommonsSeededQualification";
import { renderCommonsSeededQualificationMarkdown } from "../../app/src/lib/garpa/renderCommonsSeededQualification";

describe("GARPA Commons-seeded qualification", () => {
  it("binds seeded requalification and reaches the existing qualification gate", () => {
    const request = buildSeededQualificationRequest();
    const validated = validateCommonsSeededQualificationRequest(request);
    expect(validated.ok, validated.errors.join("; ")).toBe(true);
    const result = runCommonsSeededQualificationGate(validated.value!);
    expect(result.passed, JSON.stringify(result)).toBe(true);
    expect(result.state).toBe("seeded_qualification_admitted");
    expect(result.qualificationGate?.state).toBe(
      "admitted_for_build_manifest",
    );
    expect(result.seededComponentIds).toEqual(["component-sensor-v1-target"]);
    expect(result.boundSeededComponentIds).toEqual([
      "component-sensor-v1-target",
    ]);
  });

  it("blocks a forged seeded-architecture result digest", () => {
    const request = buildSeededQualificationRequest();
    request.expectedSeededArchitectureResultDigest = "a".repeat(64);
    const result = runCommonsSeededQualificationGate(request);
    expect(result.state).toBe("seeded_qualification_blocked");
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "seeded_architecture_result_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks mission-outcome digest drift", () => {
    const request = buildSeededQualificationRequest();
    request.targetMissionOutcomeDigest = "b".repeat(64);
    const result = runCommonsSeededQualificationGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "mission_outcome_digest_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a missing seeded-component qualification binding", () => {
    const request = buildSeededQualificationRequest();
    request.seededComponentBindings = [];
    const result = runCommonsSeededQualificationGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_component_binding_missing",
      ),
    ).toBe(true);
  });

  it("blocks source-revision substitution inside the binding", () => {
    const request = buildSeededQualificationRequest();
    request.seededComponentBindings[0]!.sourceObjectDigest = "c".repeat(64);
    const result = runCommonsSeededQualificationGate(request);
    expect(
      result.findings.some((finding) => finding.state === "seeded_source_mismatch"),
    ).toBe(true);
  });

  it("blocks architecture-selection digest drift", () => {
    const request = buildSeededQualificationRequest();
    request.seededComponentBindings[0]!.architectureSelectionDigest =
      "d".repeat(64);
    const result = runCommonsSeededQualificationGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_selection_digest_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks omitted seeded risks and residuals", () => {
    const request = buildSeededQualificationRequest();
    request.seededComponentBindings[0]!.riskIds = [];
    request.seededComponentBindings[0]!.residualIds = [];
    const result = runCommonsSeededQualificationGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_risk_coverage_mismatch",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_residual_coverage_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks removal of the source-bound requalification test", () => {
    const request = buildSeededQualificationRequest();
    request.seededComponentBindings[0]!.requiredTestClosures = [];
    const result = runCommonsSeededQualificationGate(request);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "required_requalification_test_missing",
      ),
    ).toBe(true);
  });

  it("blocks closures that do not resolve to exercising scenarios", () => {
    const request = buildSeededQualificationRequest();
    request.seededComponentBindings[0]!.requiredTestClosures[0]!.scenarioIds = [
      "scenario-missing",
    ];
    const result = runCommonsSeededQualificationGate(request);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "requalification_test_reference_invalid",
      ),
    ).toBe(true);
  });

  it("blocks a scenario that changes the admitted target environment", () => {
    const request = buildSeededQualificationRequest();
    request.qualificationContract.scenarios[0]!.environment.lighting =
      "variable";
    const result = runCommonsSeededQualificationGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "target_environment_not_exercised",
      ),
    ).toBe(true);
  });

  it("returns incomplete when the existing threshold gate fails", () => {
    const request = buildSeededQualificationRequest();
    const latency = request.qualificationContract.metrics.find(
      (metric) => metric.id === "q-target-latency",
    )!;
    latency.threshold = 3;
    const result = runCommonsSeededQualificationGate(request);
    expect(result.state).toBe("seeded_qualification_incomplete");
    expect(result.qualificationGate?.state).toBe(
      "threshold_or_baseline_mismatch",
    );
  });

  it("returns incomplete while the contract remains unfrozen", () => {
    const request = buildSeededQualificationRequest();
    request.qualificationContract.state = "candidate";
    const result = runCommonsSeededQualificationGate(request);
    expect(result.state).toBe("seeded_qualification_incomplete");
    expect(result.qualificationGate?.state).toBe("contract_not_frozen");
  });

  it("returns incomplete when the accounting boundary changes", () => {
    const request = buildSeededQualificationRequest();
    request.qualificationContract.accountingBoundary.currency = "EUR";
    const result = runCommonsSeededQualificationGate(request);
    expect(result.state).toBe("seeded_qualification_incomplete");
    expect(result.qualificationGate?.state).toBe(
      "accounting_boundary_mismatch",
    );
  });

  it("renders the binding, existing gate, and build-manifest boundary", () => {
    const request = buildSeededQualificationRequest();
    const result = runCommonsSeededQualificationGate(request);
    const markdown = renderCommonsSeededQualificationMarkdown(request, result);
    expect(markdown).toContain("# GARPA Commons-Seeded Qualification");
    expect(markdown).toContain("component-sensor-v1-target");
    expect(markdown).toContain("admitted_for_build_manifest");
    expect(markdown).toContain("cannot transfer a source-case test result");
  });
});
