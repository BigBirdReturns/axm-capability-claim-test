import type {
  CounterevidenceAction,
  CounterevidenceDisposition,
  CounterevidenceReviewRequest,
  CounterevidenceReviewResult,
  SupersessionReceipt,
} from "../../types/garpaCounterevidence";

function actionFor(
  disposition: CounterevidenceDisposition,
): CounterevidenceAction {
  switch (disposition) {
    case "target_release_stale":
      return "resolve_current_release";
    case "insufficient":
    case "duplicative":
      return "no_change";
    case "supports_current_release":
      return "record_support";
    case "narrows_current_release":
    case "contradicts_current_release":
      return "prepare_superseding_release";
    case "requires_requalification":
      return "reopen_qualification";
    case "requires_new_case_version":
      return "open_new_case_version";
  }
}

function requiredActions(
  disposition: CounterevidenceDisposition,
  affectedClaimIds: string[],
): string[] {
  switch (disposition) {
    case "target_release_stale":
      return [
        "Resolve the current governing release and retarget the packet without changing the submitted evidence artifacts.",
      ];
    case "insufficient":
      return [
        "Retain the packet as submitted but request evidence that passes the claim-evidence gate.",
      ];
    case "duplicative":
      return [
        "Link the packet to the existing evidence lineage; do not create a duplicate claim revision.",
      ];
    case "supports_current_release":
      return [
        `Record the new support against claims ${affectedClaimIds.join(", ")} without rewriting the current release.`,
      ];
    case "narrows_current_release":
      return [
        `Prepare a superseding release that narrows claims ${affectedClaimIds.join(", ")}.`,
        "Preserve the prior release and correction history.",
      ];
    case "contradicts_current_release":
      return [
        `Prepare a superseding release that addresses contradictory evidence for claims ${affectedClaimIds.join(", ")}.`,
        "Preserve the prior release, disclose the contradiction, and identify which conclusion changed.",
      ];
    case "requires_requalification":
      return [
        `Reopen qualification for claims ${affectedClaimIds.join(", ")} under a new frozen contract or regression set.`,
        "Mark publication conclusions dependent on those claims as under review without deleting the current release.",
      ];
    case "requires_new_case_version":
      return [
        "Open a new offering-version record linked to the existing case lineage.",
        "Do not mutate the evaluated version or treat rebranding as a clean identity.",
      ];
  }
}

function controlQuestion(
  disposition: CounterevidenceDisposition,
  affectedClaimIds: string[],
): string {
  switch (disposition) {
    case "target_release_stale":
      return "Which release currently governs, and does the submitted evidence address the same claim revision?";
    case "insufficient":
      return "What source, measurement, version, fixture, or method would make the requested correction evidence-bearing?";
    case "duplicative":
      return "Does the packet add any new proposition, version, venue, measurement, or limitation beyond the existing evidence lineage?";
    case "supports_current_release":
      return `Does the additional support change any scope or confidence boundary for ${affectedClaimIds.join(", ")}, or can it remain case evidence without a new release?`;
    case "narrows_current_release":
      return `What exact narrower wording preserves the supported portion of ${affectedClaimIds.join(", ")} while carrying the new limitation?`;
    case "contradicts_current_release":
      return `Which result controls the contradiction for ${affectedClaimIds.join(", ")}, and what evidence or repeat would falsify that choice?`;
    case "requires_requalification":
      return `Which frozen scenario, metric, or configuration must be rerun before ${affectedClaimIds.join(", ")} can be republished?`;
    case "requires_new_case_version":
      return "Is the new evidence about the evaluated offering version, or does it define a distinct successor configuration that requires separate qualification?";
  }
}

export function runCounterevidenceReview(
  request: CounterevidenceReviewRequest,
): CounterevidenceReviewResult {
  const targetStale =
    request.packet.targetReleaseId !== request.currentReleaseId ||
    request.packet.targetReleaseDigest !== request.currentReleaseDigest;

  const effects = request.claimAssessments.map((assessment) => assessment.effect);
  let disposition: CounterevidenceDisposition;

  if (targetStale) {
    disposition = "target_release_stale";
  } else if (request.validatedEvidenceCellIds.length === 0) {
    disposition = request.duplicateEvidenceCellIds.length > 0
      ? "duplicative"
      : "insufficient";
  } else if (effects.includes("new_offering_version")) {
    disposition = "requires_new_case_version";
  } else if (effects.includes("requires_requalification")) {
    disposition = "requires_requalification";
  } else if (effects.includes("contradicts")) {
    disposition = "contradicts_current_release";
  } else if (effects.includes("narrows")) {
    disposition = "narrows_current_release";
  } else if (effects.includes("supports")) {
    disposition = "supports_current_release";
  } else {
    disposition = "insufficient";
  }

  const affectedClaimIds = Array.from(
    new Set(
      request.claimAssessments
        .filter((assessment) => assessment.effect !== "no_effect")
        .map((assessment) => assessment.claimId),
    ),
  );
  const action = actionFor(disposition);
  const accepted = [
    "supports_current_release",
    "narrows_current_release",
    "contradicts_current_release",
    "requires_requalification",
    "requires_new_case_version",
  ].includes(disposition);
  const supersessionRequired = [
    "narrows_current_release",
    "contradicts_current_release",
    "requires_requalification",
  ].includes(disposition);

  return {
    packetId: request.packet.packetId,
    targetCaseId: request.packet.targetCaseId,
    targetReleaseId: request.packet.targetReleaseId,
    disposition,
    action,
    accepted,
    supersessionRequired,
    affectedClaimIds,
    validatedEvidenceCellIds: request.validatedEvidenceCellIds,
    duplicateEvidenceCellIds: request.duplicateEvidenceCellIds,
    rejectedEvidenceCellIds: request.rejectedEvidenceCellIds,
    preserveTargetRelease: true,
    requiredActions: requiredActions(disposition, affectedClaimIds),
    controlQuestion: controlQuestion(disposition, affectedClaimIds),
  };
}

export function buildSupersessionReceipt(
  request: CounterevidenceReviewRequest,
  review: CounterevidenceReviewResult,
  options: {
    receiptId: string;
    candidateSuccessorReleaseId: string;
    createdAt: string;
  },
): SupersessionReceipt | undefined {
  if (!review.supersessionRequired) return undefined;
  return {
    schemaVersion: 1,
    receiptId: options.receiptId,
    caseId: request.packet.targetCaseId,
    counterevidencePacketId: request.packet.packetId,
    supersededReleaseId: request.currentReleaseId,
    supersededReleaseDigest: request.currentReleaseDigest,
    supersededReleaseNumber: request.currentReleaseNumber,
    candidateSuccessorReleaseId: options.candidateSuccessorReleaseId,
    candidateSuccessorReleaseNumber: request.currentReleaseNumber + 1,
    changedClaimIds: review.affectedClaimIds,
    reason: `${review.disposition}: ${request.packet.requestedCorrection}`,
    requiredUpstreamActions: review.requiredActions,
    createdAt: options.createdAt,
    state: "candidate",
  };
}
