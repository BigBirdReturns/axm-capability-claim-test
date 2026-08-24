import { describe, expect, it } from "vitest";
import { computeCommonsSeededAsBuiltReceiptDigest } from "../../app/src/lib/garpa/commonsSeededBuildReceiptDigest";
import { renderCommonsSeededBuildReceiptMarkdown } from "../../app/src/lib/garpa/renderCommonsSeededBuildReceipt";
import { runCommonsSeededBuildReceiptGate } from "../../app/src/lib/garpa/runCommonsSeededBuildReceiptGate";
import { validateCommonsSeededBuildReceiptRequest } from "../../app/src/lib/garpa/validateCommonsSeededBuildReceipt";
import { buildSeededBuildReceiptRequest } from "../fixtures/garpaCommonsSeededBuildReceiptFixture";

function refreshReceiptDigest(request: ReturnType<typeof buildSeededBuildReceiptRequest>): void {
  request.asBuiltReceipt.receiptDigest =
    computeCommonsSeededAsBuiltReceiptDigest(request.asBuiltReceipt);
}

describe("GARPA Commons-seeded as-built receipt validation", () => {
  it("accepts the complete source-bound as-built receipt", () => {
    const request = buildSeededBuildReceiptRequest();
    const result = validateCommonsSeededBuildReceiptRequest(request);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects duplicate installed component identities", () => {
    const request = buildSeededBuildReceiptRequest();
    request.asBuiltReceipt.installedComponents.push(
      structuredClone(request.asBuiltReceipt.installedComponents[0]!),
    );
    refreshReceiptDigest(request);
    const result = validateCommonsSeededBuildReceiptRequest(request);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("duplicate id");
  });
});

describe("GARPA Commons-seeded as-built receipt gate", () => {
  it("admits the exact assembled target for preflight", () => {
    const request = buildSeededBuildReceiptRequest();
    const result = runCommonsSeededBuildReceiptGate(request);
    expect(result.passed, JSON.stringify(result)).toBe(true);
    expect(result.state).toBe("seeded_build_receipt_admitted");
    expect(result.installedComponentIds).toContain(
      "component-sensor-v1-target",
    );
    expect(result.substitutedComponentIds).toEqual([]);
    expect(result.asBuiltReceipt?.qualificationTransferred).toBe(false);
    expect(result.asBuiltReceipt?.missionEquivalenceClaimed).toBe(false);
  });

  it("blocks a forged seeded build-manifest result digest", () => {
    const request = buildSeededBuildReceiptRequest();
    request.expectedSeededBuildManifestResultDigest = "a".repeat(64);
    const result = runCommonsSeededBuildReceiptGate(request);
    expect(result.state).toBe("seeded_build_receipt_blocked");
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "seeded_build_manifest_result_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a changed as-built receipt after digest freeze", () => {
    const request = buildSeededBuildReceiptRequest();
    request.asBuiltReceipt.installedComponents[0]!.installedBy = "Unknown actor";
    const result = runCommonsSeededBuildReceiptGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "as_built_receipt_digest_mismatch",
      ),
    ).toBe(true);
  });

  it("refuses installed model, firmware, and configuration drift", () => {
    const request = buildSeededBuildReceiptRequest();
    const sensor = request.asBuiltReceipt.installedComponents.find(
      (item) => item.componentId === "component-sensor-v1-target",
    )!;
    sensor.exactModelOrVersion = "sensor-v2";
    sensor.firmwareOrRuntimeVersion = "2.0.0";
    sensor.configurationDigest = "changed-config";
    refreshReceiptDigest(request);
    const result = runCommonsSeededBuildReceiptGate(request);
    expect(result.state).toBe("seeded_build_receipt_incomplete");
    expect(
      result.findings.some(
        (finding) => finding.state === "installed_component_identity_mismatch",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "installed_component_firmware_mismatch",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "installed_component_configuration_mismatch",
      ),
    ).toBe(true);
  });

  it("requires one serial or lot identifier per hardware unit", () => {
    const request = buildSeededBuildReceiptRequest();
    const sensor = request.asBuiltReceipt.installedComponents.find(
      (item) => item.componentId === "component-sensor-v1-target",
    )!;
    sensor.serialOrLotIds = [];
    refreshReceiptDigest(request);
    const result = runCommonsSeededBuildReceiptGate(request);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "installed_component_serial_custody_missing",
      ),
    ).toBe(true);
  });

  it("refuses any post-qualification substitution of the seeded component", () => {
    const request = buildSeededBuildReceiptRequest();
    request.asBuiltReceipt.substitutions.push({
      substitutionId: "substitute-seeded-sensor",
      originalComponentId: "component-sensor-v1-target",
      replacementComponentId: "component-sensor-v2-target",
      policy: "architecture_review",
      approvalReceiptIds: ["architecture-review-1"],
      regressionMetricIds: ["q-target-detection", "q-target-latency"],
      evidenceArtifactIds: [
        request.asBuiltReceipt.artifacts[0]!.artifactId,
      ],
      executedAt: request.asBuiltReceipt.completedAt,
    });
    refreshReceiptDigest(request);
    const result = runCommonsSeededBuildReceiptGate(request);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "seeded_component_substitution_forbidden",
      ),
    ).toBe(true);
  });

  it("requires every frozen calibration item to pass with artifacts", () => {
    const request = buildSeededBuildReceiptRequest();
    request.asBuiltReceipt.calibrationReceipts[0]!.state = "failed";
    request.asBuiltReceipt.calibrationReceipts[0]!.evidenceArtifactIds = [];
    refreshReceiptDigest(request);
    const result = runCommonsSeededBuildReceiptGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "calibration_receipt_failed",
      ),
    ).toBe(true);
  });

  it("requires every frozen assembly step to pass under the exact scope", () => {
    const request = buildSeededBuildReceiptRequest();
    const step = request.asBuiltReceipt.assemblyStepReceipts[0]!;
    step.state = "failed";
    step.componentIds = [];
    refreshReceiptDigest(request);
    const result = runCommonsSeededBuildReceiptGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "assembly_step_receipt_failed",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "assembly_step_scope_mismatch",
      ),
    ).toBe(true);
  });

  it("requires actual cost and labor evidence", () => {
    const request = buildSeededBuildReceiptRequest();
    request.asBuiltReceipt.actualCosts = request.asBuiltReceipt.actualCosts.slice(1);
    request.asBuiltReceipt.labor[0]!.evidenceArtifactIds = [];
    refreshReceiptDigest(request);
    const result = runCommonsSeededBuildReceiptGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "actual_cost_trace_incomplete",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "labor_evidence_missing",
      ),
    ).toBe(true);
  });

  it("does not permit an unresolved deviation to disappear into the receipt", () => {
    const request = buildSeededBuildReceiptRequest();
    request.asBuiltReceipt.deviations.push({
      deviationId: "deviation-seeded-mount",
      description: "Seeded sensor mount changed after manifest freeze.",
      affectedComponentIds: ["component-sensor-v1-target"],
      affectedCustomCodeIds: [],
      affectedCompatibilityEdgeIds: [],
      disposition: "accepted",
      approvalReceiptIds: ["approval-1"],
      evidenceArtifactIds: [request.asBuiltReceipt.artifacts[0]!.artifactId],
    });
    refreshReceiptDigest(request);
    const result = runCommonsSeededBuildReceiptGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "deviation_unresolved",
      ),
    ).toBe(true);
  });

  it("refuses a receipt that predates the frozen manifest", () => {
    const request = buildSeededBuildReceiptRequest();
    request.asBuiltReceipt.startedAt = "2020-01-01T00:00:00.000Z";
    refreshReceiptDigest(request);
    const result = runCommonsSeededBuildReceiptGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "as_built_time_order_invalid",
      ),
    ).toBe(true);
  });

  it("refuses qualification or mission-equivalence transfer", () => {
    const request = buildSeededBuildReceiptRequest();
    (request.asBuiltReceipt as unknown as { qualificationTransferred: boolean })
      .qualificationTransferred = true;
    (request.asBuiltReceipt as unknown as { missionEquivalenceClaimed: boolean })
      .missionEquivalenceClaimed = true;
    refreshReceiptDigest(request);
    const result = runCommonsSeededBuildReceiptGate(request);
    expect(result.state).toBe("seeded_build_receipt_blocked");
  });

  it("renders installed identity, execution custody, and the preflight boundary", () => {
    const request = buildSeededBuildReceiptRequest();
    const result = runCommonsSeededBuildReceiptGate(request);
    const markdown = renderCommonsSeededBuildReceiptMarkdown(request, result);
    expect(markdown).toContain("# GARPA Commons-Seeded As-Built Receipt");
    expect(markdown).toContain("component-sensor-v1-target");
    expect(markdown).toContain("serial/lot");
    expect(markdown).toContain("Admitted for target preflight: true");
    expect(markdown).toContain("next lawful state is target preflight");
  });
});
