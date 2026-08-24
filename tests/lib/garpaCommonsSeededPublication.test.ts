import { describe, expect, it } from "vitest";
import { renderCommonsSeededPublicationMarkdown } from "../../app/src/lib/garpa/renderCommonsSeededPublication";
import { runCommonsSeededPublicationGate } from "../../app/src/lib/garpa/runCommonsSeededPublicationGate";
import { validateCommonsSeededPublicationRequest } from "../../app/src/lib/garpa/validateCommonsSeededPublication";
import {
  buildCommonsSeededPublicationRequest,
  refreshCommonsSeededPublicationEnvelope,
} from "../fixtures/garpaCommonsSeededPublicationFixture";

describe("GARPA Commons-seeded publication validation", () => {
  it("accepts the complete digest-bound publication request", () => {
    const request = buildCommonsSeededPublicationRequest();
    const result = validateCommonsSeededPublicationRequest(request);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });
});

describe("GARPA Commons-seeded publication gate", () => {
  it("admits the exact deterministic claim package and preserves publication readiness", () => {
    const request = buildCommonsSeededPublicationRequest();
    const result = runCommonsSeededPublicationGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.state).toBe("seeded_publication_admitted");
    expect(result.publicationReady).toBe(true);
    expect(result.publicationState).toBe("publication_ready");
    expect(result.expectedClaims.length).toBe(
      request.publicationPackage.claims.length,
    );
  });

  it("admits a coherent rights-blocked record without authorizing publication", () => {
    const request = buildCommonsSeededPublicationRequest();
    request.publicationPackage.rightsReview.state = "blocked";
    refreshCommonsSeededPublicationEnvelope(request);
    const result = runCommonsSeededPublicationGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.publicationReady).toBe(false);
    expect(result.publicationState).toBe("rights_unresolved");
  });

  it("blocks omission of a mandatory residual claim", () => {
    const request = buildCommonsSeededPublicationRequest();
    const residualIndex = request.publicationPackage.claims.findIndex(
      (claim) => claim.claimClass === "residual",
    );
    expect(residualIndex).toBeGreaterThanOrEqual(0);
    request.publicationPackage.claims.splice(residualIndex, 1);
    refreshCommonsSeededPublicationEnvelope(request);
    const result = runCommonsSeededPublicationGate(request);
    expect(result.state).toBe("seeded_publication_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "publication_claim_set_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks rewritten favorable claim text", () => {
    const request = buildCommonsSeededPublicationRequest();
    request.publicationPackage.claims[0]!.text =
      "The target system is universally equivalent to the vendor product.";
    refreshCommonsSeededPublicationEnvelope(request);
    const result = runCommonsSeededPublicationGate(request);
    expect(result.state).toBe("seeded_publication_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "publication_claim_set_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks stale upstream receipt substitution", () => {
    const request = buildCommonsSeededPublicationRequest();
    request.publicationPackage.upstreamDigests.build = "a".repeat(64);
    refreshCommonsSeededPublicationEnvelope(request);
    const result = runCommonsSeededPublicationGate(request);
    expect(result.state).toBe("seeded_publication_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "publication_upstream_digest_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a forged vendor-parity result digest", () => {
    const request = buildCommonsSeededPublicationRequest();
    request.expectedSeededVendorParityResultDigest = "a".repeat(64);
    const result = runCommonsSeededPublicationGate(request);
    expect(result.state).toBe("seeded_publication_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "vendor_parity_result_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks omission of content-addressed vendor evidence from publication custody", () => {
    const request = buildCommonsSeededPublicationRequest();
    request.publicationEnvelope.publicationArtifacts.pop();
    refreshCommonsSeededPublicationEnvelope(request);
    const result = runCommonsSeededPublicationGate(request);
    expect(result.state).toBe("seeded_publication_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "publication_artifact_record_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a changed parity state", () => {
    const request = buildCommonsSeededPublicationRequest();
    request.publicationPackage.vendorParityState = "same_fixture_miss";
    refreshCommonsSeededPublicationEnvelope(request);
    const result = runCommonsSeededPublicationGate(request);
    expect(result.state).toBe("seeded_publication_blocked");
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "publication_vendor_parity_state_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks review chronology outside the current publication window", () => {
    const request = buildCommonsSeededPublicationRequest();
    request.publicationPackage.rightsReview.reviewedAt =
      "2026-01-01T00:00:00Z";
    refreshCommonsSeededPublicationEnvelope(request);
    const result = runCommonsSeededPublicationGate(request);
    expect(result.state).toBe("seeded_publication_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "rights_review_time_order_invalid",
      ),
    ).toBe(true);
  });

  it("refuses unrestricted equivalence, deployment, release authority, and premature public release", () => {
    const request = buildCommonsSeededPublicationRequest();
    const envelope = request.publicationEnvelope as unknown as {
      unrestrictedEquivalenceClaimed: boolean;
      deploymentAuthorityClaimed: boolean;
      releaseAuthorityClaimed: boolean;
      publicReleaseOccurred: boolean;
      envelopeDigest: string;
    };
    envelope.unrestrictedEquivalenceClaimed = true;
    envelope.deploymentAuthorityClaimed = true;
    envelope.releaseAuthorityClaimed = true;
    envelope.publicReleaseOccurred = true;
    refreshCommonsSeededPublicationEnvelope(request);
    const result = runCommonsSeededPublicationGate(request);
    expect(result.state).toBe("seeded_publication_blocked");
  });

  it("renders claim custody, ordinary state, and the release boundary", () => {
    const request = buildCommonsSeededPublicationRequest();
    const result = runCommonsSeededPublicationGate(request);
    const markdown = renderCommonsSeededPublicationMarkdown(request, result);
    expect(markdown).toContain("# GARPA Commons-Seeded Publication Custody");
    expect(markdown).toContain("Ordinary publication state: publication_ready");
    expect(markdown).toContain("does not establish release integrity");
  });
});
