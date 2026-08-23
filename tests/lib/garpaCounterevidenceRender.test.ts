import { describe, expect, it } from "vitest";
import fixture from "../../examples/garpa-counterevidence/review-request.json";
import type { CounterevidenceReviewRequest } from "../../app/src/types/garpaCounterevidence";
import {
  buildSupersessionReceipt,
  runCounterevidenceReview,
} from "../../app/src/lib/garpa/runCounterevidenceReview";
import { renderCounterevidenceReviewMarkdown } from "../../app/src/lib/garpa/renderCounterevidenceReview";

describe("GARPA counterevidence review renderer", () => {
  it("renders the contradiction, preserved R1, and candidate R2 receipt", () => {
    const request = structuredClone(fixture) as unknown as CounterevidenceReviewRequest;
    const review = runCounterevidenceReview(request);
    const supersession = buildSupersessionReceipt(request, review, {
      receiptId: "supersession-receipt-0001",
      candidateSuccessorReleaseId: "GARPA-PUBLICATION-0001-R2",
      createdAt: "2026-08-23T02:15:00Z",
    });
    const markdown = renderCounterevidenceReviewMarkdown(review, supersession);

    expect(markdown).toContain("# GARPA Counterevidence Review — counterevidence-0001");
    expect(markdown).toContain("Disposition: contradicts_current_release");
    expect(markdown).toContain("Prior release preserved: true");
    expect(markdown).toContain("Preserved release: GARPA-PUBLICATION-0001-R1");
    expect(markdown).toContain("Candidate successor: GARPA-PUBLICATION-0001-R2");
    expect(markdown).toContain("## Control question");
  });
});
