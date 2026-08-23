import { describe, expect, it } from "vitest";
import fixture from "../../examples/garpa-counterevidence/review-request.json";
import type { CounterevidenceReviewRequest } from "../../app/src/types/garpaCounterevidence";
import {
  validateCounterevidencePacket,
  validateCounterevidenceReviewRequest,
} from "../../app/src/lib/garpa/validateCounterevidence";
import {
  buildSupersessionReceipt,
  runCounterevidenceReview,
} from "../../app/src/lib/garpa/runCounterevidenceReview";

function request(): CounterevidenceReviewRequest {
  return structuredClone(fixture) as unknown as CounterevidenceReviewRequest;
}

describe("GARPA counterevidence validation", () => {
  it("accepts the source-addressable contradiction review request", () => {
    const packet = validateCounterevidencePacket(fixture.packet);
    expect(packet.ok, packet.errors.join("; ")).toBe(true);

    const review = validateCounterevidenceReviewRequest(fixture);
    expect(review.ok, review.errors.join("; ")).toBe(true);
  });

  it("rejects an assessment outside the targeted current claim set", () => {
    const value = request();
    value.claimAssessments[0]!.claimId = "unknown-claim";
    const result = validateCounterevidenceReviewRequest(value);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("outside the target claim set");
  });

  it("rejects a material effect supported only by rejected evidence", () => {
    const value = request();
    value.validatedEvidenceCellIds = [];
    value.rejectedEvidenceCellIds = ["ce-latency-2"];
    const result = validateCounterevidenceReviewRequest(value);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("requires validated evidence");
  });

  it("rejects evidence assigned to more than one review partition", () => {
    const value = request();
    value.duplicateEvidenceCellIds = ["ce-latency-2"];
    const result = validateCounterevidenceReviewRequest(value);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("more than one review partition");
  });
});

describe("GARPA counterevidence review", () => {
  it("accepts contradictory evidence and prepares supersession without overwriting R1", () => {
    const value = request();
    const result = runCounterevidenceReview(value);
    expect(result.disposition).toBe("contradicts_current_release");
    expect(result.action).toBe("prepare_superseding_release");
    expect(result.accepted).toBe(true);
    expect(result.supersessionRequired).toBe(true);
    expect(result.preserveTargetRelease).toBe(true);
    expect(result.affectedClaimIds).toEqual(["pub-parity-1"]);
  });

  it("returns target-release-stale when the packet addresses an obsolete digest", () => {
    const value = request();
    value.currentReleaseDigest =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const result = runCounterevidenceReview(value);
    expect(result.disposition).toBe("target_release_stale");
    expect(result.action).toBe("resolve_current_release");
    expect(result.accepted).toBe(false);
  });

  it("returns insufficient when no evidence cell passes review", () => {
    const value = request();
    value.validatedEvidenceCellIds = [];
    value.rejectedEvidenceCellIds = ["ce-latency-2"];
    value.claimAssessments = [
      {
        claimId: "pub-parity-1",
        effect: "no_effect",
        evidenceCellIds: ["ce-latency-2"],
        reason: "The submitted artifact does not establish the requested correction.",
      },
    ];
    const result = runCounterevidenceReview(value);
    expect(result.disposition).toBe("insufficient");
    expect(result.action).toBe("no_change");
  });

  it("returns duplicative when the packet adds no new evidence lineage", () => {
    const value = request();
    value.validatedEvidenceCellIds = [];
    value.duplicateEvidenceCellIds = ["ce-latency-2"];
    value.claimAssessments = [
      {
        claimId: "pub-parity-1",
        effect: "no_effect",
        evidenceCellIds: ["ce-latency-2"],
        reason: "The same evidence is already present in the case.",
      },
    ];
    const result = runCounterevidenceReview(value);
    expect(result.disposition).toBe("duplicative");
  });

  it("records additional support without superseding the current release", () => {
    const value = request();
    value.claimAssessments[0]!.effect = "supports";
    value.claimAssessments[0]!.reason = "Independent repeat supports the current claim.";
    const result = runCounterevidenceReview(value);
    expect(result.disposition).toBe("supports_current_release");
    expect(result.action).toBe("record_support");
    expect(result.supersessionRequired).toBe(false);
  });

  it("narrows a claim through a superseding release", () => {
    const value = request();
    value.claimAssessments[0]!.effect = "narrows";
    value.claimAssessments[0]!.reason = "The claim holds only under a narrower load boundary.";
    const result = runCounterevidenceReview(value);
    expect(result.disposition).toBe("narrows_current_release");
    expect(result.supersessionRequired).toBe(true);
  });

  it("reopens qualification before issuing a corrected release", () => {
    const value = request();
    value.claimAssessments[0]!.effect = "requires_requalification";
    value.claimAssessments[0]!.reason = "The new evidence identifies a fixture condition absent from qualification.";
    const result = runCounterevidenceReview(value);
    expect(result.disposition).toBe("requires_requalification");
    expect(result.action).toBe("reopen_qualification");
    expect(result.supersessionRequired).toBe(true);
  });

  it("opens a linked case version when evidence concerns a successor configuration", () => {
    const value = request();
    value.claimAssessments[0]!.effect = "new_offering_version";
    value.claimAssessments[0]!.reason = "The submitted result concerns version 2.0 rather than the evaluated version.";
    const result = runCounterevidenceReview(value);
    expect(result.disposition).toBe("requires_new_case_version");
    expect(result.action).toBe("open_new_case_version");
    expect(result.supersessionRequired).toBe(false);
  });
});

describe("GARPA supersession receipt", () => {
  it("creates a candidate R2 receipt while preserving the R1 identity and digest", () => {
    const value = request();
    const review = runCounterevidenceReview(value);
    const receipt = buildSupersessionReceipt(value, review, {
      receiptId: "supersession-receipt-0001",
      candidateSuccessorReleaseId: "GARPA-PUBLICATION-0001-R2",
      createdAt: "2026-08-23T02:15:00Z",
    });
    expect(receipt).toBeDefined();
    expect(receipt?.supersededReleaseId).toBe("GARPA-PUBLICATION-0001-R1");
    expect(receipt?.supersededReleaseDigest).toBe(
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    );
    expect(receipt?.candidateSuccessorReleaseNumber).toBe(2);
    expect(receipt?.changedClaimIds).toEqual(["pub-parity-1"]);
    expect(receipt?.state).toBe("candidate");
  });

  it("does not invent a supersession receipt for supporting evidence", () => {
    const value = request();
    value.claimAssessments[0]!.effect = "supports";
    const review = runCounterevidenceReview(value);
    const receipt = buildSupersessionReceipt(value, review, {
      receiptId: "unused",
      candidateSuccessorReleaseId: "unused",
      createdAt: "2026-08-23T02:15:00Z",
    });
    expect(receipt).toBeUndefined();
  });
});
