import { describe, expect, it } from "vitest";
import type { CommonsSeededBuildManifestRequest } from "../../app/src/types/garpaCommonsSeededBuildManifest";
import {
  computeBuildManifestComponentDigest,
  computeBuildManifestSubstitutionPolicyDigest,
  computeCommonsSeededBuildManifestResultDigest,
  computeTargetBuildManifestDigest,
} from "../../app/src/lib/garpa/commonsSeededBuildManifestDigest";
import { renderCommonsSeededBuildManifestMarkdown } from "../../app/src/lib/garpa/renderCommonsSeededBuildManifest";
import { runCommonsSeededBuildManifestGate } from "../../app/src/lib/garpa/runCommonsSeededBuildManifestGate";
import { validateCommonsSeededBuildManifestRequest } from "../../app/src/lib/garpa/validateCommonsSeededBuildManifest";
import { buildSeededBuildManifestRequest } from "../fixtures/garpaCommonsSeededBuildManifestFixture";

function refreshManifestDigest(request: CommonsSeededBuildManifestRequest): void {
  request.buildManifest.manifestDigest = computeTargetBuildManifestDigest(
    request.buildManifest,
  );
}

function refreshSeededComponentDigest(
  request: CommonsSeededBuildManifestRequest,
): void {
  const binding = request.seededComponentBindings[0]!;
  const component = request.buildManifest.components.find(
    (item) => item.componentId === binding.componentId,
  )!;
  binding.buildComponentDigest = computeBuildManifestComponentDigest(component);
}

function refreshSeededPolicyDigest(
  request: CommonsSeededBuildManifestRequest,
): void {
  const binding = request.seededComponentBindings[0]!;
  const policy = request.buildManifest.substitutionPolicies.find(
    (item) => item.componentId === binding.componentId,
  )!;
  binding.substitutionPolicyDigest =
    computeBuildManifestSubstitutionPolicyDigest(policy);
}

describe("GARPA Commons-seeded build manifest", () => {
  it("binds seeded build custody and reaches the existing build-manifest gate", () => {
    const request = buildSeededBuildManifestRequest();
    const validated = validateCommonsSeededBuildManifestRequest(request);
    expect(validated.ok, validated.errors.join("; ")).toBe(true);
    const result = runCommonsSeededBuildManifestGate(validated.value!);
    expect(result.passed, JSON.stringify(result)).toBe(true);
    expect(result.state).toBe("seeded_build_manifest_admitted");
    expect(result.buildManifestGate?.state).toBe("admitted_for_assembly");
    expect(result.seededComponentIds).toEqual(["component-sensor-v1-target"]);
    expect(result.boundSeededComponentIds).toEqual([
      "component-sensor-v1-target",
    ]);
  });

  it("blocks a forged seeded-qualification result digest", () => {
    const request = buildSeededBuildManifestRequest();
    request.expectedSeededQualificationResultDigest = "a".repeat(64);
    const result = runCommonsSeededBuildManifestGate(request);
    expect(result.state).toBe("seeded_build_manifest_blocked");
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "seeded_qualification_result_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a missing seeded-component build binding", () => {
    const request = buildSeededBuildManifestRequest();
    request.seededComponentBindings = [];
    const result = runCommonsSeededBuildManifestGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_component_binding_missing",
      ),
    ).toBe(true);
  });

  it("blocks source or qualification-binding substitution", () => {
    const request = buildSeededBuildManifestRequest();
    request.seededComponentBindings[0]!.sourceObjectDigest = "b".repeat(64);
    request.seededComponentBindings[0]!.qualificationBindingId =
      "binding-missing";
    const result = runCommonsSeededBuildManifestGate(request);
    expect(
      result.findings.some((finding) => finding.state === "seeded_source_mismatch"),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "qualification_binding_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks architecture configuration or component-record digest drift", () => {
    const request = buildSeededBuildManifestRequest();
    request.seededComponentBindings[0]!.architectureConfigurationDigest =
      "c".repeat(64);
    request.seededComponentBindings[0]!.buildComponentDigest = "d".repeat(64);
    const result = runCommonsSeededBuildManifestGate(request);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "architecture_configuration_digest_mismatch",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "build_component_digest_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks exact-model, firmware, price, or mapping drift even with refreshed local digests", () => {
    const request = buildSeededBuildManifestRequest();
    const component = request.buildManifest.components[0]!;
    component.exactModelOrVersion = "sensor-v2";
    component.firmwareOrRuntimeVersion = "2.0.0";
    component.unitCost = 251;
    component.functionIds = ["f-detect-target"];
    refreshSeededComponentDigest(request);
    refreshManifestDigest(request);
    const result = runCommonsSeededBuildManifestGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_component_identity_mismatch",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "seeded_component_configuration_mismatch",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_component_mapping_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks any seeded replacement policy that bypasses a new projection chain", () => {
    const request = buildSeededBuildManifestRequest();
    const policy = request.buildManifest.substitutionPolicies[0]!;
    policy.policy = "equivalent_with_retest";
    refreshSeededPolicyDigest(request);
    refreshManifestDigest(request);
    const result = runCommonsSeededBuildManifestGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_substitution_policy_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks removal of a seeded risk or residual qualification regression", () => {
    const request = buildSeededBuildManifestRequest();
    const policy = request.buildManifest.substitutionPolicies[0]!;
    policy.requiredRegressionTestIds = ["q-target-detection"];
    refreshSeededPolicyDigest(request);
    refreshManifestDigest(request);
    const result = runCommonsSeededBuildManifestGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_substitution_policy_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a build binding for a target-only component", () => {
    const request = buildSeededBuildManifestRequest();
    const unexpected = structuredClone(request.seededComponentBindings[0]!);
    unexpected.bindingId = "binding-detector-unexpected";
    unexpected.componentId = "component-detector-target";
    request.seededComponentBindings.push(unexpected);
    const result = runCommonsSeededBuildManifestGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_component_binding_unexpected",
      ),
    ).toBe(true);
  });

  it("blocks omitted seeded calibration or assembly custody", () => {
    const request = buildSeededBuildManifestRequest();
    request.buildManifest.calibrationPlan =
      request.buildManifest.calibrationPlan.filter(
        (item) => item.subjectId !== "component-sensor-v1-target",
      );
    request.buildManifest.assemblySteps[0]!.componentIds =
      request.buildManifest.assemblySteps[0]!.componentIds.filter(
        (id) => id !== "component-sensor-v1-target",
      );
    refreshManifestDigest(request);
    const result = runCommonsSeededBuildManifestGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_calibration_custody_mismatch",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_assembly_custody_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks manifest content or freeze-time forgery", () => {
    const request = buildSeededBuildManifestRequest();
    request.buildManifest.manifestDigest = "e".repeat(64);
    request.frozenAt = "2026-08-23T19:00:00Z";
    const result = runCommonsSeededBuildManifestGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "build_manifest_digest_mismatch",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "build_manifest_freeze_time_mismatch",
      ),
    ).toBe(true);
  });

  it("returns incomplete when the existing build-manifest gate finds a target-only omission", () => {
    const request = buildSeededBuildManifestRequest();
    request.buildManifest.humanRoles = [];
    refreshManifestDigest(request);
    const result = runCommonsSeededBuildManifestGate(request);
    expect(result.state).toBe("seeded_build_manifest_incomplete");
    expect(result.buildManifestGate?.state).toBe(
      "human_role_manifest_incomplete",
    );
  });

  it("produces a deterministic content-addressable result for the next stage", () => {
    const request = buildSeededBuildManifestRequest();
    const first = runCommonsSeededBuildManifestGate(request);
    const second = runCommonsSeededBuildManifestGate(
      structuredClone(request),
    );
    expect(computeCommonsSeededBuildManifestResultDigest(first)).toBe(
      computeCommonsSeededBuildManifestResultDigest(second),
    );
  });

  it("does not manufacture an as-built receipt or execution authority", () => {
    const result = runCommonsSeededBuildManifestGate(
      buildSeededBuildManifestRequest(),
    ) as unknown as Record<string, unknown>;
    expect(result.buildReceipt).toBeUndefined();
    expect(result.executionAuthority).toBeUndefined();
    expect(result.preflightReceipt).toBeUndefined();
    expect(result.testRunReceipt).toBeUndefined();
  });

  it("renders seeded custody, the existing gate, and the as-built boundary", () => {
    const request = buildSeededBuildManifestRequest();
    const result = runCommonsSeededBuildManifestGate(request);
    const markdown = renderCommonsSeededBuildManifestMarkdown(request, result);
    expect(markdown).toContain("# GARPA Commons-Seeded Build Manifest");
    expect(markdown).toContain("component-sensor-v1-target");
    expect(markdown).toContain("admitted_for_assembly");
    expect(markdown).toContain("as-built receipt");
  });
});
