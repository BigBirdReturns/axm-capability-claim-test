import { describe, expect, it } from "vitest";
import { runExternalPublicationReceiptGate } from "../../app/src/lib/garpa/runExternalPublicationReceiptGate";
import { validateExternalPublicationReceiptRequest } from "../../app/src/lib/garpa/validateExternalPublicationReceipt";
import {
  buildCommonsSeededExternalPublicationRequest,
  refreshExternalPublicationReceiptRequest,
} from "../fixtures/garpaCommonsSeededExternalPublicationFixture";

function request() {
  return structuredClone(
    buildCommonsSeededExternalPublicationRequest()
      .externalPublicationRequest,
  );
}

function observedRegistryRequest() {
  const value = request();
  value.receipt.evidenceClass = "observed_external";
  value.receipt.syntheticQualificationOnly = false;
  value.receipt.channel = "web";
  value.receipt.publisher = "Qualification fixture external publisher";
  value.receipt.sourceLocator =
    "https://example.invalid/garpa/registry/GARPA-COMMONS-TARGET-0001";
  value.receipt.publicRegistryPublished = true;
  value.receipt.publicReleaseOccurred = false;
  value.artifacts.forEach((artifact) => {
    artifact.sourceLocator = value.receipt.sourceLocator;
  });
  refreshExternalPublicationReceiptRequest(value);
  return value;
}

describe("GARPA external-publication receipt validation", () => {
  it("accepts the complete synthetic qualification receipt", () => {
    const result = validateExternalPublicationReceiptRequest(request());
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });
});

describe("GARPA external-publication receipt gate", () => {
  it("admits a synthetic qualification receipt without asserting an event", () => {
    const result = runExternalPublicationReceiptGate(request());
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.eventObserved).toBe(false);
    expect(result.syntheticQualificationOnly).toBe(true);
    expect(result.publicRegistryPublished).toBe(false);
    expect(result.publicReleaseOccurred).toBe(false);
  });

  it("admits a structurally observed registry event at an external locator", () => {
    const result = runExternalPublicationReceiptGate(
      observedRegistryRequest(),
    );
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.eventObserved).toBe(true);
    expect(result.eventKind).toBe("registry_entry_published");
    expect(result.publicRegistryPublished).toBe(true);
    expect(result.publicReleaseOccurred).toBe(false);
  });

  it("admits a structurally observed release-bundle distribution event", () => {
    const value = observedRegistryRequest();
    value.receipt.eventKind = "release_bundle_distributed";
    value.receipt.publicRegistryPublished = false;
    value.receipt.publicReleaseOccurred = true;
    refreshExternalPublicationReceiptRequest(value);
    const result = runExternalPublicationReceiptGate(value);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.eventObserved).toBe(true);
    expect(result.eventKind).toBe("release_bundle_distributed");
    expect(result.publicReleaseOccurred).toBe(true);
  });

  it("blocks synthetic evidence that claims a real occurrence", () => {
    const value = request();
    value.receipt.publicRegistryPublished = true;
    refreshExternalPublicationReceiptRequest(value);
    const result = runExternalPublicationReceiptGate(value);
    expect(result.passed).toBe(false);
    expect(
      result.findings.some(
        (finding) => finding.state === "synthetic_occurrence_attempted",
      ),
    ).toBe(true);
  });

  it("blocks a capture artifact whose digest does not match its bytes", () => {
    const value = request();
    value.artifacts[0]!.sha256 = "a".repeat(64);
    value.receipt.receiptDigest = value.receipt.receiptDigest;
    const result = runExternalPublicationReceiptGate(value);
    expect(result.passed).toBe(false);
    expect(
      result.findings.some(
        (finding) => finding.state === "artifact_digest_invalid",
      ),
    ).toBe(true);
  });

  it("blocks a receipt that omits its captured artifact", () => {
    const value = request();
    value.receipt.artifactIds = [];
    const validation = validateExternalPublicationReceiptRequest(value);
    expect(validation.ok).toBe(false);
  });

  it("blocks observed evidence that uses a synthetic locator", () => {
    const value = request();
    value.receipt.evidenceClass = "observed_external";
    value.receipt.syntheticQualificationOnly = false;
    value.receipt.publicRegistryPublished = true;
    refreshExternalPublicationReceiptRequest(value);
    const result = runExternalPublicationReceiptGate(value);
    expect(result.passed).toBe(false);
    expect(
      result.findings.some(
        (finding) => finding.state === "observed_locator_invalid",
      ),
    ).toBe(true);
  });
});
