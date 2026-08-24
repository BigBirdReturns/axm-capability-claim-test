import { describe, expect, it } from "vitest";
import { renderCommonsSeededVendorParityMarkdown } from "../../app/src/lib/garpa/renderCommonsSeededVendorParity";
import { runCommonsSeededVendorParityGate } from "../../app/src/lib/garpa/runCommonsSeededVendorParityGate";
import { validateCommonsSeededVendorParityRequest } from "../../app/src/lib/garpa/validateCommonsSeededVendorParity";
import {
  buildCommonsSeededVendorParityRequest,
  refreshCommonsSeededVendorParityEnvelope,
} from "../fixtures/garpaCommonsSeededVendorParityFixture";

describe("GARPA Commons-seeded vendor-parity validation", () => {
  it("accepts the complete digest-bound parity request", () => {
    const request = buildCommonsSeededVendorParityRequest();
    const result = validateCommonsSeededVendorParityRequest(request);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });
});

describe("GARPA Commons-seeded vendor-parity gate", () => {
  it("admits an exact-version same-fixture match", () => {
    const request = buildCommonsSeededVendorParityRequest();
    const result = runCommonsSeededVendorParityGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.state).toBe("seeded_vendor_parity_admitted");
    expect(result.parityState).toBe("same_fixture_match");
    expect(result.derivedGarpaObservations.length).toBeGreaterThan(0);
  });

  it("admits a coherent same-fixture miss without laundering it", () => {
    const request = buildCommonsSeededVendorParityRequest();
    const observation = request.vendorParityRequest.observations.find(
      (candidate) => candidate.subject === "vendor",
    )!;
    observation.value =
      typeof observation.value === "boolean"
        ? !observation.value
        : typeof observation.value === "number"
          ? observation.value + 10
          : `${observation.value}-changed`;
    refreshCommonsSeededVendorParityEnvelope(request);
    const result = runCommonsSeededVendorParityGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.parityState).toBe("same_fixture_miss");
    expect(result.vendorParityEvaluation?.missedMetricIds.length).toBeGreaterThan(0);
  });

  it("admits a missing exact-version vendor baseline as missing", () => {
    const request = buildCommonsSeededVendorParityRequest();
    delete request.vendorParityRequest.vendorVersion;
    delete request.parityEnvelope.vendorVersion;
    request.vendorParityRequest.observations =
      request.vendorParityRequest.observations.filter(
        (observation) => observation.subject === "garpa",
      );
    request.vendorParityRequest.scenarioComparisons = [];
    request.parityEnvelope.vendorArtifacts = [];
    refreshCommonsSeededVendorParityEnvelope(request);
    const result = runCommonsSeededVendorParityGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.parityState).toBe("vendor_baseline_missing");
  });

  it("admits an evidence-only comparison without upgrading it", () => {
    const request = buildCommonsSeededVendorParityRequest();
    request.vendorParityRequest.observations
      .filter((observation) => observation.subject === "vendor")
      .forEach((observation) => {
        observation.evidenceControl = "externally_attributed";
      });
    request.vendorParityRequest.scenarioComparisons.forEach((comparison) => {
      comparison.state = "reported_only";
    });
    refreshCommonsSeededVendorParityEnvelope(request);
    const result = runCommonsSeededVendorParityGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.parityState).toBe("evidence_only_comparison");
  });

  it("blocks a forged mission-evaluation result digest", () => {
    const request = buildCommonsSeededVendorParityRequest();
    request.expectedSeededMissionEvaluationResultDigest = "a".repeat(64);
    const result = runCommonsSeededVendorParityGate(request);
    expect(result.state).toBe("seeded_vendor_parity_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "mission_evaluation_result_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks caller-selected GARPA observations", () => {
    const request = buildCommonsSeededVendorParityRequest();
    const observation = request.vendorParityRequest.observations.find(
      (candidate) => candidate.subject === "garpa",
    )!;
    observation.value =
      typeof observation.value === "boolean"
        ? !observation.value
        : typeof observation.value === "number"
          ? observation.value + 1
          : `${observation.value}-changed`;
    refreshCommonsSeededVendorParityEnvelope(request);
    const result = runCommonsSeededVendorParityGate(request);
    expect(result.state).toBe("seeded_vendor_parity_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "garpa_observation_set_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks vendor observations without immutable artifact custody", () => {
    const request = buildCommonsSeededVendorParityRequest();
    request.parityEnvelope.vendorArtifacts.pop();
    refreshCommonsSeededVendorParityEnvelope(request);
    const result = runCommonsSeededVendorParityGate(request);
    expect(result.state).toBe("seeded_vendor_parity_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "vendor_artifact_custody_missing",
      ),
    ).toBe(true);
  });

  it("blocks a favorable metric subset", () => {
    const request = buildCommonsSeededVendorParityRequest();
    const removedMetricId = request.vendorParityRequest.requiredMetricIds.pop()!;
    request.vendorParityRequest.essentialMetricIds =
      request.vendorParityRequest.essentialMetricIds.filter(
        (metricId) => metricId !== removedMetricId,
      );
    request.vendorParityRequest.comparators =
      request.vendorParityRequest.comparators.filter(
        (comparator) => comparator.metricId !== removedMetricId,
      );
    request.vendorParityRequest.observations =
      request.vendorParityRequest.observations.filter(
        (observation) => observation.metricId !== removedMetricId,
      );
    const retainedVendorArtifacts = new Set(
      request.vendorParityRequest.observations
        .filter((observation) => observation.subject === "vendor")
        .flatMap((observation) => observation.evidenceArtifactIds),
    );
    request.parityEnvelope.vendorArtifacts =
      request.parityEnvelope.vendorArtifacts.filter((artifact) =>
        retainedVendorArtifacts.has(artifact.artifactId),
      );
    refreshCommonsSeededVendorParityEnvelope(request);
    const result = runCommonsSeededVendorParityGate(request);
    expect(result.state).toBe("seeded_vendor_parity_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "parity_metric_contract_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a changed vendor identity after request freeze", () => {
    const request = buildCommonsSeededVendorParityRequest();
    request.parityEnvelope.vendorVersion = "reference-2.0.0";
    refreshCommonsSeededVendorParityEnvelope(request);
    const result = runCommonsSeededVendorParityGate(request);
    expect(result.state).toBe("seeded_vendor_parity_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "vendor_identity_mismatch",
      ),
    ).toBe(true);
  });

  it("refuses transfer, unrestricted equivalence, deployment, and publication authority", () => {
    const request = buildCommonsSeededVendorParityRequest();
    const envelope = request.parityEnvelope as unknown as {
      qualificationTransferred: boolean;
      unrestrictedEquivalenceClaimed: boolean;
      deploymentAuthorityClaimed: boolean;
      publicationAuthorityClaimed: boolean;
      envelopeDigest: string;
    };
    envelope.qualificationTransferred = true;
    envelope.unrestrictedEquivalenceClaimed = true;
    envelope.deploymentAuthorityClaimed = true;
    envelope.publicationAuthorityClaimed = true;
    refreshCommonsSeededVendorParityEnvelope(request);
    const result = runCommonsSeededVendorParityGate(request);
    expect(result.state).toBe("seeded_vendor_parity_blocked");
  });

  it("renders parity state, metric custody, and the downstream boundary", () => {
    const request = buildCommonsSeededVendorParityRequest();
    const result = runCommonsSeededVendorParityGate(request);
    const markdown = renderCommonsSeededVendorParityMarkdown(request, result);
    expect(markdown).toContain("# GARPA Commons-Seeded Vendor Parity");
    expect(markdown).toContain("Substantive parity state: same_fixture_match");
    expect(markdown).toContain("does not establish unrestricted product equivalence");
  });
});
