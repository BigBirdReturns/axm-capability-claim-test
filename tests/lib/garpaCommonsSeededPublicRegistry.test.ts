import { describe, expect, it } from "vitest";
import { renderCommonsSeededPublicRegistryMarkdown } from "../../app/src/lib/garpa/renderCommonsSeededPublicRegistry";
import { runCommonsSeededPublicRegistryGate } from "../../app/src/lib/garpa/runCommonsSeededPublicRegistryGate";
import { validateCommonsSeededPublicRegistryRequest } from "../../app/src/lib/garpa/validateCommonsSeededPublicRegistry";
import {
  buildCommonsSeededPublicRegistryRequest,
  refreshCommonsSeededPublicRegistryEnvelope,
  refreshCommonsSeededPublicRegistryFromRelease,
} from "../fixtures/garpaCommonsSeededPublicRegistryFixture";

describe("GARPA Commons-seeded public-registry validation", () => {
  it("accepts the exact initial R1 registry update", () => {
    const request = buildCommonsSeededPublicRegistryRequest();
    const result = validateCommonsSeededPublicRegistryRequest(request);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });
});

describe("GARPA Commons-seeded public-registry gate", () => {
  it("admits verified R1 as the sole current governing release", () => {
    const request = buildCommonsSeededPublicRegistryRequest();
    const result = runCommonsSeededPublicRegistryGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.state).toBe("seeded_public_registry_admitted");
    expect(result.registryUpdateApplied).toBe(true);
    expect(result.registryState).toBe("registry_update_admitted");
    expect(result.nextEntry?.releases).toHaveLength(1);
    expect(result.nextEntry?.currentReleaseId).toBe(
      request.seededReleaseRequest.releaseManifest.releaseId,
    );
  });

  it("blocks a forged release-result digest", () => {
    const request = buildCommonsSeededPublicRegistryRequest();
    request.expectedSeededReleaseResultDigest = "a".repeat(64);
    const result = runCommonsSeededPublicRegistryGate(request);
    expect(result.state).toBe("seeded_public_registry_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "release_result_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks hidden preexisting release history", () => {
    const request = buildCommonsSeededPublicRegistryRequest();
    request.registryUpdateRequest.currentEntry.releases.push({
      releaseId: "HIDDEN-R1",
      releaseNumber: 1,
      manifestDigest: "a".repeat(64),
      state: "current",
      createdAt: "2026-01-01T00:00:00Z",
    });
    request.registryUpdateRequest.currentEntry.currentReleaseId =
      "HIDDEN-R1";
    request.registryUpdateRequest.currentEntry.currentReleaseDigest =
      "a".repeat(64);
    request.registryUpdateRequest.expectedCurrentReleaseId =
      "HIDDEN-R1";
    request.registryUpdateRequest.expectedCurrentReleaseDigest =
      "a".repeat(64);
    refreshCommonsSeededPublicRegistryEnvelope(request);
    const result = runCommonsSeededPublicRegistryGate(request);
    expect(result.state).toBe("seeded_public_registry_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "registry_current_entry_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks invented aliases and identity lineage", () => {
    const request = buildCommonsSeededPublicRegistryRequest();
    request.registryUpdateRequest.identityPatch.aliasesAdded = [
      "Universal Vendor Equivalent",
    ];
    refreshCommonsSeededPublicRegistryEnvelope(request);
    const result = runCommonsSeededPublicRegistryGate(request);
    expect(result.state).toBe("seeded_public_registry_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "registry_identity_patch_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a changed candidate release manifest", () => {
    const request = buildCommonsSeededPublicRegistryRequest();
    request.registryUpdateRequest.candidateRelease.manifestDigest =
      "a".repeat(64);
    refreshCommonsSeededPublicRegistryEnvelope(request);
    const result = runCommonsSeededPublicRegistryGate(request);
    expect(result.state).toBe("seeded_public_registry_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "registry_release_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a changed case state or disposition", () => {
    const request = buildCommonsSeededPublicRegistryRequest();
    request.registryUpdateRequest.candidateCaseState =
      "evaluation_complete";
    request.registryUpdateRequest.candidateDisposition = "acquire";
    refreshCommonsSeededPublicRegistryEnvelope(request);
    const result = runCommonsSeededPublicRegistryGate(request);
    expect(result.state).toBe("seeded_public_registry_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "registry_transition_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks stale update chronology", () => {
    const request = buildCommonsSeededPublicRegistryRequest();
    request.registryUpdateRequest.updatedAt =
      "2026-01-01T00:00:00Z";
    refreshCommonsSeededPublicRegistryEnvelope(request);
    const result = runCommonsSeededPublicRegistryGate(request);
    expect(result.state).toBe("seeded_public_registry_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "registry_time_order_invalid",
      ),
    ).toBe(true);
  });

  it("blocks a changed updated-entry digest", () => {
    const request = buildCommonsSeededPublicRegistryRequest();
    request.registryEnvelope.nextEntryDigest = "a".repeat(64);
    request.registryEnvelope.envelopeDigest = "b".repeat(64);
    const result = runCommonsSeededPublicRegistryGate(request);
    expect(result.state).toBe("seeded_public_registry_blocked");
  });

  it("refuses external registry publication, public release, deployment, and equivalence assertions", () => {
    const request = buildCommonsSeededPublicRegistryRequest();
    const envelope = request.registryEnvelope as unknown as {
      publicRegistryPublished: boolean;
      publicReleaseOccurred: boolean;
      deploymentAuthorityClaimed: boolean;
      unrestrictedEquivalenceClaimed: boolean;
      envelopeDigest: string;
    };
    envelope.publicRegistryPublished = true;
    envelope.publicReleaseOccurred = true;
    envelope.deploymentAuthorityClaimed = true;
    envelope.unrestrictedEquivalenceClaimed = true;
    refreshCommonsSeededPublicRegistryEnvelope(request);
    const result = runCommonsSeededPublicRegistryGate(request);
    expect(result.state).toBe("seeded_public_registry_blocked");
  });

  it("recomputes registry custody after a refreshed release chain", () => {
    const request = buildCommonsSeededPublicRegistryRequest();
    refreshCommonsSeededPublicRegistryFromRelease(request);
    const result = runCommonsSeededPublicRegistryGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
  });

  it("renders the governing release and external-publication boundary", () => {
    const request = buildCommonsSeededPublicRegistryRequest();
    const result = runCommonsSeededPublicRegistryGate(request);
    const markdown = renderCommonsSeededPublicRegistryMarkdown(
      request,
      result,
    );
    expect(markdown).toContain(
      "# GARPA Commons-Seeded Public Registry Admission",
    );
    expect(markdown).toContain(
      "Ordinary registry state: registry_update_admitted",
    );
    expect(markdown).toContain(
      "does not mean that an external public registry was published",
    );
  });
});
