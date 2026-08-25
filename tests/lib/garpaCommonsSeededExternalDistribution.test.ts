import { describe, expect, it } from "vitest";
import { renderCommonsSeededExternalDistributionMarkdown } from "../../app/src/lib/garpa/renderCommonsSeededExternalDistribution";
import { runCommonsSeededExternalDistributionGate } from "../../app/src/lib/garpa/runCommonsSeededExternalDistributionGate";
import { validateCommonsSeededExternalDistributionRequest } from "../../app/src/lib/garpa/validateCommonsSeededExternalDistribution";
import {
  buildCommonsSeededExternalDistributionRequest,
  buildObservedExternalDistributionTestRequest,
  refreshCommonsSeededExternalDistributionEnvelope,
  refreshCommonsSeededExternalDistributionFromRegistry,
} from "../fixtures/garpaCommonsSeededExternalDistributionFixture";

describe("GARPA Commons-seeded external-distribution validation", () => {
  it("accepts the non-public qualification fixture", () => {
    const request =
      buildCommonsSeededExternalDistributionRequest();
    const result =
      validateCommonsSeededExternalDistributionRequest(request);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects duplicate evidence artifact identifiers", () => {
    const request =
      buildObservedExternalDistributionTestRequest();
    request.distributionObservation.evidenceArtifacts.push({
      ...request.distributionObservation.evidenceArtifacts[0]!,
    });
    const result =
      validateCommonsSeededExternalDistributionRequest(request);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "duplicate artifactId",
    );
  });
});

describe("GARPA Commons-seeded external-distribution gate", () => {
  it("admits a qualification fixture without recording an external event", () => {
    const request =
      buildCommonsSeededExternalDistributionRequest();
    const result =
      runCommonsSeededExternalDistributionGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(
      true,
    );
    expect(result.state).toBe(
      "seeded_external_distribution_fixture_admitted",
    );
    expect(result.receiptAdmitted).toBe(true);
    expect(result.eventObserved).toBe(false);
    expect(result.publicReleaseOccurred).toBe(false);
    expect(result.publicRegistryPublished).toBe(false);
  });

  it("admits a test-only observed event with exact external custody", () => {
    const request =
      buildObservedExternalDistributionTestRequest();
    const result =
      runCommonsSeededExternalDistributionGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(
      true,
    );
    expect(result.state).toBe(
      "seeded_external_distribution_observed",
    );
    expect(result.eventObserved).toBe(true);
    expect(result.publicReleaseOccurred).toBe(true);
    expect(result.publicRegistryPublished).toBe(true);
  });

  it("blocks a forged public-registry result digest", () => {
    const request =
      buildCommonsSeededExternalDistributionRequest();
    request.expectedSeededPublicRegistryResultDigest =
      "a".repeat(64);
    const result =
      runCommonsSeededExternalDistributionGate(request);
    expect(result.state).toBe(
      "seeded_external_distribution_blocked",
    );
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "public_registry_result_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a changed governing release coordinate", () => {
    const request =
      buildCommonsSeededExternalDistributionRequest();
    request.distributionObservation.releaseManifestDigest =
      "a".repeat(64);
    refreshCommonsSeededExternalDistributionEnvelope(request);
    const result =
      runCommonsSeededExternalDistributionGate(request);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "distribution_release_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks omission of a governing release file", () => {
    const request =
      buildCommonsSeededExternalDistributionRequest();
    request.distributionObservation.observedFiles.pop();
    refreshCommonsSeededExternalDistributionEnvelope(request);
    const result =
      runCommonsSeededExternalDistributionGate(request);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "distribution_file_set_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks changed externally observed file metadata", () => {
    const request =
      buildObservedExternalDistributionTestRequest();
    request.distributionObservation.observedFiles[0]!.sha256 =
      "a".repeat(64);
    refreshCommonsSeededExternalDistributionEnvelope(request);
    const result =
      runCommonsSeededExternalDistributionGate(request);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "distribution_file_set_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a qualification fixture that asserts publication", () => {
    const request =
      buildCommonsSeededExternalDistributionRequest();
    request.distributionEnvelope.publicReleaseOccurred = true;
    request.distributionEnvelope.publicRegistryPublished = true;
    request.distributionEnvelope.envelopeDigest =
      "a".repeat(64);
    const result =
      runCommonsSeededExternalDistributionGate(request);
    expect(result.state).toBe(
      "seeded_external_distribution_blocked",
    );
  });

  it("blocks an observed event without attributable platform and retrieval evidence", () => {
    const request =
      buildObservedExternalDistributionTestRequest();
    request.distributionObservation.evidenceArtifacts = [
      {
        ...request.distributionObservation.evidenceArtifacts[0]!,
        role: "other",
        evidenceControl: "claimant_controlled",
      },
    ];
    refreshCommonsSeededExternalDistributionEnvelope(request);
    const result =
      runCommonsSeededExternalDistributionGate(request);
    expect(
      result.findings.some(
        (finding) =>
          finding.state ===
          "external_event_evidence_insufficient",
      ),
    ).toBe(true);
  });

  it("blocks an observed event at a non-HTTPS destination", () => {
    const request =
      buildObservedExternalDistributionTestRequest();
    request.distributionObservation.destinationUri =
      "http://distribution.example.test/release";
    refreshCommonsSeededExternalDistributionEnvelope(request);
    const result =
      runCommonsSeededExternalDistributionGate(request);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "distribution_uri_invalid",
      ),
    ).toBe(true);
  });

  it("blocks evidence captured outside the event window", () => {
    const request =
      buildObservedExternalDistributionTestRequest();
    request.distributionObservation.evidenceArtifacts[0]!.capturedAt =
      "2026-01-01T00:00:00Z";
    refreshCommonsSeededExternalDistributionEnvelope(request);
    const result =
      runCommonsSeededExternalDistributionGate(request);
    expect(
      result.findings.some(
        (finding) =>
          finding.state ===
          "distribution_artifact_time_order_invalid",
      ),
    ).toBe(true);
  });

  it("blocks event flags that disagree with the event kind", () => {
    const request =
      buildObservedExternalDistributionTestRequest();
    request.distributionEnvelope.publicRegistryPublished = false;
    request.distributionEnvelope.envelopeDigest =
      "a".repeat(64);
    const result =
      runCommonsSeededExternalDistributionGate(request);
    expect(result.state).toBe(
      "seeded_external_distribution_blocked",
    );
  });

  it("recomputes exact custody after a refreshed registry chain", () => {
    const request =
      buildCommonsSeededExternalDistributionRequest();
    refreshCommonsSeededExternalDistributionFromRegistry(request);
    const result =
      runCommonsSeededExternalDistributionGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(
      true,
    );
  });

  it("renders fixture status and the observed-event boundary", () => {
    const request =
      buildCommonsSeededExternalDistributionRequest();
    const result =
      runCommonsSeededExternalDistributionGate(request);
    const markdown =
      renderCommonsSeededExternalDistributionMarkdown(
        request,
        result,
      );
    expect(markdown).toContain(
      "# GARPA Commons-Seeded External Distribution Receipt",
    );
    expect(markdown).toContain(
      "Mode: qualification_fixture",
    );
    expect(markdown).toContain(
      "External event observed: false",
    );
  });
});
