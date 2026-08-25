import { describe, expect, it } from "vitest";
import {
  computeCommonsSeededExternalPublicationEnvelopeDigest,
} from "../../app/src/lib/garpa/commonsSeededExternalPublicationDigest";
import { renderCommonsSeededExternalPublicationMarkdown } from "../../app/src/lib/garpa/renderCommonsSeededExternalPublication";
import { runCommonsSeededExternalPublicationGate } from "../../app/src/lib/garpa/runCommonsSeededExternalPublicationGate";
import { validateCommonsSeededExternalPublicationRequest } from "../../app/src/lib/garpa/validateCommonsSeededExternalPublication";
import {
  buildCommonsSeededExternalPublicationRequest,
  refreshCommonsSeededExternalPublicationEnvelope,
  refreshCommonsSeededExternalPublicationFromRegistry,
} from "../fixtures/garpaCommonsSeededExternalPublicationFixture";

function observedRegistryRequest() {
  const request = buildCommonsSeededExternalPublicationRequest();
  const receipt = request.externalPublicationRequest.receipt;
  receipt.evidenceClass = "observed_external";
  receipt.syntheticQualificationOnly = false;
  receipt.channel = "web";
  receipt.publisher = "Qualification fixture external publisher";
  receipt.sourceLocator =
    "https://example.invalid/garpa/registry/GARPA-COMMONS-TARGET-0001";
  receipt.publicRegistryPublished = true;
  receipt.publicReleaseOccurred = false;
  request.externalPublicationRequest.artifacts.forEach((artifact) => {
    artifact.sourceLocator = receipt.sourceLocator;
  });
  refreshCommonsSeededExternalPublicationEnvelope(request);
  return request;
}

describe("GARPA Commons-seeded external-publication validation", () => {
  it("accepts the complete digest-bound qualification receipt", () => {
    const request = buildCommonsSeededExternalPublicationRequest();
    const result = validateCommonsSeededExternalPublicationRequest(request);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });
});

describe("GARPA Commons-seeded external-publication gate", () => {
  it("admits the synthetic qualification receipt without claiming publication", () => {
    const request = buildCommonsSeededExternalPublicationRequest();
    const result = runCommonsSeededExternalPublicationGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.state).toBe("seeded_external_publication_admitted");
    expect(result.receiptAdmitted).toBe(true);
    expect(result.externalEventObserved).toBe(false);
    expect(result.syntheticQualificationOnly).toBe(true);
    expect(result.publicRegistryPublished).toBe(false);
    expect(result.publicReleaseOccurred).toBe(false);
  });

  it("preserves an observed external registry publication disposition", () => {
    const request = observedRegistryRequest();
    const result = runCommonsSeededExternalPublicationGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.externalEventObserved).toBe(true);
    expect(result.publicRegistryPublished).toBe(true);
    expect(result.publicReleaseOccurred).toBe(false);
  });

  it("preserves an observed release-bundle distribution disposition", () => {
    const request = observedRegistryRequest();
    request.externalPublicationRequest.receipt.eventKind =
      "release_bundle_distributed";
    request.externalPublicationRequest.receipt.publicRegistryPublished =
      false;
    request.externalPublicationRequest.receipt.publicReleaseOccurred = true;
    refreshCommonsSeededExternalPublicationEnvelope(request);
    const result = runCommonsSeededExternalPublicationGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.externalEventObserved).toBe(true);
    expect(result.publicReleaseOccurred).toBe(true);
  });

  it("blocks a forged public-registry result digest", () => {
    const request = buildCommonsSeededExternalPublicationRequest();
    request.expectedSeededPublicRegistryResultDigest = "a".repeat(64);
    const result = runCommonsSeededExternalPublicationGate(request);
    expect(result.state).toBe("seeded_external_publication_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "public_registry_result_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a receipt for a different case", () => {
    const request = buildCommonsSeededExternalPublicationRequest();
    request.externalPublicationRequest.receipt.caseId = "DIFFERENT-CASE";
    refreshCommonsSeededExternalPublicationEnvelope(request);
    const result = runCommonsSeededExternalPublicationGate(request);
    expect(result.state).toBe("seeded_external_publication_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "external_publication_case_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a receipt for a changed release manifest", () => {
    const request = buildCommonsSeededExternalPublicationRequest();
    request.externalPublicationRequest.receipt.releaseManifestDigest =
      "a".repeat(64);
    refreshCommonsSeededExternalPublicationEnvelope(request);
    const result = runCommonsSeededExternalPublicationGate(request);
    expect(result.state).toBe("seeded_external_publication_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "external_publication_release_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a receipt for a changed registry entry", () => {
    const request = buildCommonsSeededExternalPublicationRequest();
    request.externalPublicationRequest.receipt.registryEntryDigest =
      "a".repeat(64);
    refreshCommonsSeededExternalPublicationEnvelope(request);
    const result = runCommonsSeededExternalPublicationGate(request);
    expect(result.state).toBe("seeded_external_publication_blocked");
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "external_publication_registry_entry_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks capture evidence whose bytes do not match its digest", () => {
    const request = buildCommonsSeededExternalPublicationRequest();
    request.externalPublicationRequest.artifacts[0]!.content += "changed";
    const result = runCommonsSeededExternalPublicationGate(request);
    expect(result.state).toBe("seeded_external_publication_blocked");
    expect(
      result.ordinaryReceiptResult?.findings.some(
        (finding) => finding.state === "artifact_digest_invalid",
      ),
    ).toBe(true);
  });

  it("blocks an event that predates registry admission", () => {
    const request = buildCommonsSeededExternalPublicationRequest();
    request.externalPublicationRequest.receipt.publishedAt =
      "2026-01-01T00:00:00Z";
    request.externalPublicationRequest.artifacts[0]!.capturedAt =
      "2026-01-01T00:01:00Z";
    request.externalPublicationRequest.receipt.observedAt =
      "2026-01-01T00:02:00Z";
    request.externalPublicationRequest.admittedAt =
      "2026-01-01T00:03:00Z";
    refreshCommonsSeededExternalPublicationEnvelope(request);
    const result = runCommonsSeededExternalPublicationGate(request);
    expect(result.state).toBe("seeded_external_publication_blocked");
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "external_publication_time_order_invalid",
      ),
    ).toBe(true);
  });

  it("blocks promotion of the ordinary event disposition", () => {
    const request = buildCommonsSeededExternalPublicationRequest();
    request.publicationEnvelope.externalEventObserved = true;
    request.publicationEnvelope.publicRegistryPublished = true;
    request.publicationEnvelope.envelopeDigest =
      computeCommonsSeededExternalPublicationEnvelopeDigest(
        request.publicationEnvelope,
      );
    const result = runCommonsSeededExternalPublicationGate(request);
    expect(result.state).toBe("seeded_external_publication_blocked");
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "external_publication_event_state_mismatch",
      ),
    ).toBe(true);
  });

  it("refuses deployment and unrestricted-equivalence assertions", () => {
    const request = buildCommonsSeededExternalPublicationRequest();
    const envelope = request.publicationEnvelope as unknown as {
      deploymentAuthorityClaimed: boolean;
      unrestrictedEquivalenceClaimed: boolean;
    };
    envelope.deploymentAuthorityClaimed = true;
    envelope.unrestrictedEquivalenceClaimed = true;
    const result = runCommonsSeededExternalPublicationGate(request);
    expect(result.state).toBe("seeded_external_publication_blocked");
  });

  it("recomputes exact custody after a refreshed registry chain", () => {
    const request = buildCommonsSeededExternalPublicationRequest();
    refreshCommonsSeededExternalPublicationFromRegistry(request);
    const result = runCommonsSeededExternalPublicationGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
  });

  it("renders the evidence class and occurrence boundary", () => {
    const request = buildCommonsSeededExternalPublicationRequest();
    const result = runCommonsSeededExternalPublicationGate(request);
    const markdown = renderCommonsSeededExternalPublicationMarkdown(
      request,
      result,
    );
    expect(markdown).toContain(
      "# GARPA Commons-Seeded External Publication Receipt",
    );
    expect(markdown).toContain(
      "Evidence class: synthetic_qualification",
    );
    expect(markdown).toContain("External event observed: false");
    expect(markdown).toContain(
      "does not prove that any external publication or distribution event occurred",
    );
  });
});
