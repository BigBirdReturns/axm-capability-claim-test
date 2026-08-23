import { describe, expect, it } from "vitest";
import fixture from "../../examples/garpa-commons/commons-request.json";
import expected from "../../examples/garpa-commons/commons-result.json";
import type { CommonsAdmissionRequest } from "../../app/src/types/garpaCommons";
import { validateCommonsAdmissionRequest } from "../../app/src/lib/garpa/validateCommonsAdmission";
import { runCommonsAdmissionGate } from "../../app/src/lib/garpa/runCommonsAdmissionGate";
import { renderCommonsAdmissionMarkdown } from "../../app/src/lib/garpa/renderCommonsAdmission";

function request(): CommonsAdmissionRequest {
  return structuredClone(fixture) as unknown as CommonsAdmissionRequest;
}

describe("GARPA capability commons validation", () => {
  it("accepts the current-release commons request", () => {
    const result = validateCommonsAdmissionRequest(fixture);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects an implementation reference to an absent architecture pattern", () => {
    const value = request();
    value.primitives[0]!.observedImplementations[0]!.architecturePatternIds = [
      "pattern-missing",
    ];
    const result = validateCommonsAdmissionRequest(value);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("unknown architecture pattern");
  });

  it("rejects duplicate object ids", () => {
    const value = request();
    value.primitives.push(structuredClone(value.primitives[0]!));
    const result = validateCommonsAdmissionRequest(value);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("duplicate value");
  });
});

describe("GARPA capability commons admission gate", () => {
  it("admits the released primitive, scoped component observation, and pattern", () => {
    const result = runCommonsAdmissionGate(request());
    expect(result).toEqual(expected);
  });

  it("refuses to seed the current commons from a superseded release", () => {
    const value = request();
    value.releaseVerificationState = "superseded_valid";
    const result = runCommonsAdmissionGate(value);
    expect(result.passed).toBe(false);
    expect(result.findings[0]?.state).toBe("release_not_admissible");
    expect(result.blockedObjectIds).toHaveLength(3);
  });

  it("blocks source lineage that omits the release being admitted", () => {
    const value = request();
    value.primitives[0]!.sourceReleaseIds = ["GARPA-PUBLICATION-0001-R0"];
    const result = runCommonsAdmissionGate(value);
    expect(result.passed).toBe(false);
    expect(result.findings.some((finding) => finding.state === "source_scope_mismatch")).toBe(true);
    expect(result.blockedObjectIds).toContain("primitive-detect-before-boundary");
  });

  it("blocks an overclaimed repeated primitive with one source case", () => {
    const value = request();
    value.primitives[0]!.maturity = "repeated";
    value.primitives[0]!.qualificationRefs[0]!.state = "repeated";
    const result = runCommonsAdmissionGate(value);
    expect(result.passed).toBe(false);
    expect(result.findings.some((finding) => finding.state === "primitive_maturity_unearned")).toBe(true);
  });

  it("requires residuals and falsification conditions on every primitive", () => {
    const value = request();
    value.primitives[0]!.residuals = [];
    value.primitives[0]!.falsificationConditions = [];
    const result = runCommonsAdmissionGate(value);
    expect(result.findings.some((finding) => finding.state === "primitive_residual_missing")).toBe(true);
  });

  it("blocks duplicate primitive functional identities", () => {
    const value = request();
    const duplicate = structuredClone(value.primitives[0]!);
    duplicate.primitiveId = "primitive-duplicate";
    value.primitives.push(duplicate);
    const result = runCommonsAdmissionGate(value);
    expect(result.findings.filter((finding) => finding.state === "duplicate_commons_identity")).toHaveLength(2);
    expect(result.blockedObjectIds).toContain("primitive-duplicate");
  });

  it("blocks generic component identity", () => {
    const value = request();
    value.componentObservations[0]!.componentIdentity.exactModelOrVersion = "unknown";
    const result = runCommonsAdmissionGate(value);
    expect(result.findings.some((finding) => finding.state === "component_identity_incomplete")).toBe(true);
  });

  it("blocks locally qualified component evidence without run custody", () => {
    const value = request();
    value.componentObservations[0]!.runReceiptIds = [];
    const result = runCommonsAdmissionGate(value);
    expect(result.findings.some((finding) => finding.state === "component_state_unearned")).toBe(true);
  });

  it("blocks a locally qualified component with an unmeasured metric", () => {
    const value = request();
    value.componentObservations[0]!.metricResults[0]!.thresholdResult = "not_measured";
    const result = runCommonsAdmissionGate(value);
    expect(result.findings.some((finding) => finding.state === "component_state_unearned")).toBe(true);
  });

  it("blocks an architecture pattern without implementation support", () => {
    const value = request();
    value.architecturePatterns[0]!.knownImplementationRefs = [];
    const result = runCommonsAdmissionGate(value);
    expect(result.findings.some((finding) => finding.state === "pattern_support_incomplete")).toBe(true);
  });

  it("partially admits valid objects while preserving a blocked component", () => {
    const value = request();
    value.componentObservations[0]!.runReceiptIds = [];
    const result = runCommonsAdmissionGate(value);
    expect(result.passed).toBe(false);
    expect(result.admittedPrimitiveIds).toContain("primitive-detect-before-boundary");
    expect(result.admittedArchitecturePatternIds).toContain("pattern-observe-detect-present");
    expect(result.admittedComponentObservationIds).toEqual([]);
  });
});

describe("GARPA capability commons receipt", () => {
  it("renders the release scope and refuses global qualification language", () => {
    const value = request();
    const result = runCommonsAdmissionGate(value);
    const markdown = renderCommonsAdmissionMarkdown(value, result);
    expect(markdown).toContain("GARPA Capability Commons Admission");
    expect(markdown).toContain("GARPA-PUBLICATION-0001-R1");
    expect(markdown).toContain("does not establish global component qualification");
    expect(markdown).toContain("requalification boundary");
  });
});
