import { describe, expect, it } from "vitest";
import fixture from "../../examples/garpa-registry/registry-update.json";
import type { RegistryReleaseUpdateRequest } from "../../app/src/types/garpaRegistry";
import {
  validatePublicCaseRegistryEntry,
  validateRegistryReleaseUpdateRequest,
} from "../../app/src/lib/garpa/validateCaseRegistry";
import {
  applyRegistryReleaseUpdate,
  runRegistryUpdateGate,
} from "../../app/src/lib/garpa/runRegistryUpdateGate";

function request(): RegistryReleaseUpdateRequest {
  return structuredClone(fixture) as unknown as RegistryReleaseUpdateRequest;
}

describe("GARPA public registry validation", () => {
  it("accepts the current R1 entry and candidate R2 update", () => {
    const entry = validatePublicCaseRegistryEntry(fixture.currentEntry);
    expect(entry.ok, entry.errors.join("; ")).toBe(true);

    const update = validateRegistryReleaseUpdateRequest(fixture);
    expect(update.ok, update.errors.join("; ")).toBe(true);
  });

  it("rejects two current release records", () => {
    const value = request().currentEntry;
    value.releases.push({
      releaseId: "duplicate-current",
      releaseNumber: 2,
      manifestDigest:
        "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      state: "current",
      priorReleaseDigest:
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      supersedesReleaseId: "GARPA-PUBLICATION-0001-R1",
      createdAt: "2026-08-23T00:00:00Z",
    });
    const result = validatePublicCaseRegistryEntry(value);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("more than one current release");
  });

  it("rejects noncontiguous release numbers", () => {
    const value = request().currentEntry;
    value.releases[0]!.releaseNumber = 2;
    const result = validatePublicCaseRegistryEntry(value);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("contiguous sequence");
  });
});

describe("GARPA registry update gate", () => {
  it("admits a verified R2 that supersedes the exact current R1", () => {
    const result = runRegistryUpdateGate(request());
    expect(result.passed).toBe(true);
    expect(result.state).toBe("registry_update_admitted");
    expect(result.nextReleaseNumber).toBe(2);
  });

  it("rejects a stale expected current-release pointer", () => {
    const value = request();
    value.expectedCurrentReleaseDigest =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const result = runRegistryUpdateGate(value);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("current_release_conflict");
  });

  it("rejects skipped release numbers", () => {
    const value = request();
    value.candidateRelease.releaseNumber = 3;
    const result = runRegistryUpdateGate(value);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("release_number_gap");
  });

  it("rejects release lineage that does not point to the current release", () => {
    const value = request();
    value.candidateRelease.priorReleaseDigest =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const result = runRegistryUpdateGate(value);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("release_lineage_mismatch");
  });

  it("rejects reuse of an existing release identifier or digest", () => {
    const value = request();
    value.candidateRelease.releaseId = "GARPA-PUBLICATION-0001-R1";
    const result = runRegistryUpdateGate(value);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("release_identity_reused");
  });

  it("rejects a candidate release that is not verified current", () => {
    const value = request();
    value.releaseVerificationState = "superseded_valid";
    const result = runRegistryUpdateGate(value);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("release_not_current_valid");
  });

  it("rejects a rebrand without source-backed identity lineage", () => {
    const value = request();
    value.identityPatch.canonicalSubject = "New Synthetic Brand";
    value.identityPatch.offering = "New Synthetic Brand";
    const result = runRegistryUpdateGate(value);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("identity_lineage_missing");
  });

  it("admits a source-backed rebrand and preserves the prior subject as an alias", () => {
    const value = request();
    value.identityPatch.canonicalSubject = "New Synthetic Brand";
    value.identityPatch.offering = "New Synthetic Brand";
    value.identityPatch.aliasesAdded = ["Synthetic Observation Composition"];
    value.identityPatch.lineageLinksAdded = [
      {
        id: "lineage-rebrand-1",
        fromSubject: "Synthetic Observation Composition",
        toSubject: "New Synthetic Brand",
        relation: "rebrand",
        effectiveAt: "2026-08-23T00:00:00Z",
        sourceArtifactIds: ["rebrand-record-1"],
        note: "Synthetic source-backed rebrand fixture.",
      },
    ];
    value.identityPatch.versionsAdded = [
      {
        versionId: "new-synthetic-brand-v2",
        label: "New Synthetic Brand v2",
        exactVersion: "2.0.0",
        firstSeenAt: "2026-08-23T00:00:00Z",
        sourceArtifactIds: ["rebrand-record-1"],
        state: "current",
      },
    ];

    const result = applyRegistryReleaseUpdate(value);
    expect(result.gate.passed).toBe(true);
    expect(result.entry?.canonicalSubject).toBe("New Synthetic Brand");
    expect(result.entry?.aliases).toContain("Synthetic Observation Composition");
    expect(result.entry?.lineage.map((link) => link.id)).toContain(
      "lineage-rebrand-1",
    );
    expect(
      result.entry?.versions.find((version) => version.versionId === "synthetic-observation-v1")
        ?.state,
    ).toBe("superseded");
    expect(result.entry?.currentReleaseId).toBe("GARPA-PUBLICATION-0001-R2");
  });

  it("rejects a release update against a withdrawn case", () => {
    const value = request();
    value.currentEntry.currentState = "withdrawn";
    const result = runRegistryUpdateGate(value);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("invalid_case_transition");
  });
});

describe("GARPA registry application", () => {
  it("marks R1 superseded, appends R2, and advances the current pointers", () => {
    const result = applyRegistryReleaseUpdate(request());
    expect(result.gate.passed).toBe(true);
    expect(result.entry).toBeDefined();
    expect(result.entry?.releases).toHaveLength(2);
    expect(
      result.entry?.releases.find(
        (release) => release.releaseId === "GARPA-PUBLICATION-0001-R1",
      )?.state,
    ).toBe("superseded");
    expect(
      result.entry?.releases.find(
        (release) => release.releaseId === "GARPA-PUBLICATION-0001-R2",
      )?.state,
    ).toBe("current");
    expect(result.entry?.currentReleaseDigest).toBe(
      "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    );
  });

  it("returns no candidate entry when the registry gate blocks", () => {
    const value = request();
    value.candidateRelease.caseId = "different-case";
    const result = applyRegistryReleaseUpdate(value);
    expect(result.gate.passed).toBe(false);
    expect(result.entry).toBeUndefined();
  });
});
