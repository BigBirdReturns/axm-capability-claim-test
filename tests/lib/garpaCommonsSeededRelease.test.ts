import { describe, expect, it } from "vitest";
import { renderCommonsSeededReleaseMarkdown } from "../../app/src/lib/garpa/renderCommonsSeededRelease";
import { runCommonsSeededReleaseGate } from "../../app/src/lib/garpa/runCommonsSeededReleaseGate";
import { validateCommonsSeededReleaseRequest } from "../../app/src/lib/garpa/validateCommonsSeededRelease";
import {
  buildCommonsSeededReleaseRequest,
  refreshCommonsSeededPublicationEnvelope,
  refreshCommonsSeededReleaseEnvelope,
  refreshCommonsSeededReleaseFromPublication,
} from "../fixtures/garpaCommonsSeededReleaseFixture";

describe("GARPA Commons-seeded release validation", () => {
  it("accepts the exact deterministic R1 bundle", () => {
    const request = buildCommonsSeededReleaseRequest();
    const result = validateCommonsSeededReleaseRequest(request);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });
});

describe("GARPA Commons-seeded release gate", () => {
  it("admits an exact publication-ready current release bundle", () => {
    const request = buildCommonsSeededReleaseRequest();
    const result = runCommonsSeededReleaseGate(request);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.state).toBe("seeded_release_admitted");
    expect(result.releaseVerified).toBe(true);
    expect(result.releaseState).toBe("current_valid");
    expect(result.expectedFiles.length).toBe(request.releaseFiles.length);
  });

  it("blocks release construction when the ordinary publication gate is not ready", () => {
    const request = buildCommonsSeededReleaseRequest();
    request.seededPublicationRequest.publicationPackage.rightsReview.state =
      "blocked";
    refreshCommonsSeededPublicationEnvelope(
      request.seededPublicationRequest,
    );
    refreshCommonsSeededReleaseFromPublication(request);
    const result = runCommonsSeededReleaseGate(request);
    expect(result.state).toBe("seeded_release_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "publication_not_ready",
      ),
    ).toBe(true);
  });

  it("blocks omission of a mandatory public surface", () => {
    const request = buildCommonsSeededReleaseRequest();
    request.releaseFiles = request.releaseFiles.filter(
      (file) => file.path !== "claims/residual-register.json",
    );
    refreshCommonsSeededReleaseEnvelope(request);
    const result = runCommonsSeededReleaseGate(request);
    expect(result.state).toBe("seeded_release_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "release_file_set_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks changed public dossier content even when caller hashes are refreshed", () => {
    const request = buildCommonsSeededReleaseRequest();
    const dossier = request.releaseFiles.find(
      (file) => file.path === "public-dossier.md",
    )!;
    dossier.content += "\nUnrestricted equivalence established.\n";
    refreshCommonsSeededReleaseEnvelope(request);
    const result = runCommonsSeededReleaseGate(request);
    expect(result.state).toBe("seeded_release_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "release_file_content_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a claimed file digest that does not match submitted bytes", () => {
    const request = buildCommonsSeededReleaseRequest();
    request.releaseFiles[0]!.sha256 = "a".repeat(64);
    const result = runCommonsSeededReleaseGate(request);
    expect(result.state).toBe("seeded_release_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "release_file_digest_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks an extra unmanifested file", () => {
    const request = buildCommonsSeededReleaseRequest();
    request.releaseFiles.push({
      path: "secret-extra.txt",
      mediaType: "text/plain",
      role: "other",
      required: true,
      contentEncoding: "utf-8",
      content: "secret\n",
      sha256: "0".repeat(64),
      byteLength: 7,
    });
    refreshCommonsSeededReleaseEnvelope(request);
    const result = runCommonsSeededReleaseGate(request);
    expect(result.state).toBe("seeded_release_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "release_file_set_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks stale publication package custody in the manifest", () => {
    const request = buildCommonsSeededReleaseRequest();
    request.releaseManifest.publicationPackageDigest = "a".repeat(64);
    request.releaseManifest.manifestDigest =
      "b".repeat(64);
    request.releaseEnvelope.releaseManifestDigest =
      request.releaseManifest.manifestDigest;
    refreshCommonsSeededReleaseEnvelope(request);
    const result = runCommonsSeededReleaseGate(request);
    expect(result.state).toBe("seeded_release_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "release_upstream_digest_mismatch",
      ),
    ).toBe(true);
  });

  it("refuses invented successor lineage in the first Commons release", () => {
    const request = buildCommonsSeededReleaseRequest();
    const manifest = request.releaseManifest as unknown as {
      releaseNumber: number;
      priorReleaseDigest?: string;
      supersedesReleaseId?: string;
    };
    manifest.releaseNumber = 2;
    manifest.priorReleaseDigest = "a".repeat(64);
    manifest.supersedesReleaseId = "OLDER-R1";
    const result = runCommonsSeededReleaseGate(request);
    expect(result.state).toBe("seeded_release_blocked");
  });

  it("rejects unsafe paths at request validation", () => {
    const request = buildCommonsSeededReleaseRequest();
    request.releaseFiles[0]!.path = "../escape.txt";
    const result = runCommonsSeededReleaseGate(request);
    expect(result.state).toBe("seeded_release_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "release_validation_failed",
      ),
    ).toBe(true);
  });

  it("refuses equivalence, deployment, registry, and public-release assertions", () => {
    const request = buildCommonsSeededReleaseRequest();
    const envelope = request.releaseEnvelope as unknown as {
      unrestrictedEquivalenceClaimed: boolean;
      deploymentAuthorityClaimed: boolean;
      registryUpdated: boolean;
      publicReleaseOccurred: boolean;
      envelopeDigest: string;
    };
    envelope.unrestrictedEquivalenceClaimed = true;
    envelope.deploymentAuthorityClaimed = true;
    envelope.registryUpdated = true;
    envelope.publicReleaseOccurred = true;
    refreshCommonsSeededReleaseEnvelope(request);
    const result = runCommonsSeededReleaseGate(request);
    expect(result.state).toBe("seeded_release_blocked");
  });

  it("renders verified file custody and the registry boundary", () => {
    const request = buildCommonsSeededReleaseRequest();
    const result = runCommonsSeededReleaseGate(request);
    const markdown = renderCommonsSeededReleaseMarkdown(request, result);
    expect(markdown).toContain("# GARPA Commons-Seeded Release Verification");
    expect(markdown).toContain("Ordinary release state: current_valid");
    expect(markdown).toContain("does not mean that public release");
  });
});
