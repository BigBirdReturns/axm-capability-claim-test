import type {
  CounterevidenceReviewResult,
  SupersessionReceipt,
} from "../../types/garpaCounterevidence";

function bullets(values: string[], empty: string): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : [`- ${empty}`];
}

export function renderCounterevidenceReviewMarkdown(
  review: CounterevidenceReviewResult,
  supersession?: SupersessionReceipt,
): string {
  return [
    `# GARPA Counterevidence Review — ${review.packetId}`,
    ``,
    `## Target`,
    `- Case: ${review.targetCaseId}`,
    `- Release: ${review.targetReleaseId}`,
    `- Disposition: ${review.disposition}`,
    `- Action: ${review.action}`,
    `- Accepted evidence packet: ${review.accepted}`,
    `- Supersession required: ${review.supersessionRequired}`,
    `- Prior release preserved: ${review.preserveTargetRelease}`,
    ``,
    `## Affected claims`,
    ...bullets(review.affectedClaimIds, "None."),
    ``,
    `## Evidence review`,
    `Validated evidence:`,
    ...bullets(review.validatedEvidenceCellIds, "None."),
    ``,
    `Duplicate evidence:`,
    ...bullets(review.duplicateEvidenceCellIds, "None."),
    ``,
    `Rejected evidence:`,
    ...bullets(review.rejectedEvidenceCellIds, "None."),
    ``,
    `## Required actions`,
    ...bullets(review.requiredActions, "No change required."),
    ``,
    ...(supersession
      ? [
          `## Candidate supersession`,
          `- Receipt: ${supersession.receiptId}`,
          `- Preserved release: ${supersession.supersededReleaseId}`,
          `- Preserved digest: ${supersession.supersededReleaseDigest}`,
          `- Candidate successor: ${supersession.candidateSuccessorReleaseId}`,
          `- Candidate release number: ${supersession.candidateSuccessorReleaseNumber}`,
          `- Changed claims: ${supersession.changedClaimIds.join(", ") || "None"}`,
          `- State: ${supersession.state}`,
          ``,
        ]
      : []),
    `## Control question`,
    review.controlQuestion,
    ``,
  ].join("\n");
}
