import type {
  PublicationFinding,
  PublicationGateResult,
  PublicationGateState,
  PublicationPackage,
} from "../../types/garpaPublication";

function firstState(findings: PublicationFinding[]): PublicationGateState {
  return findings[0]?.state ?? "publication_ready";
}

function claimHasPositiveSupport(
  claim: PublicationPackage["claims"][number],
): boolean {
  if (claim.claimClass === "open_question") return true;
  return claim.supportRefs.some((support) =>
    [
      "direct_source",
      "derived_from",
      "measured_by",
      "evaluated_by",
      "costed_by",
    ].includes(support.relation),
  );
}

export function runPublicationGate(
  publication: PublicationPackage,
  expectedUpstreamDigests: Record<string, string>,
): PublicationGateResult {
  const findings: PublicationFinding[] = [];
  const blockedClaimIds = new Set<string>();
  const narrowedClaimIds = new Set<string>();

  for (const [key, expected] of Object.entries(expectedUpstreamDigests)) {
    if (publication.upstreamDigests[key] !== expected) {
      findings.push({
        state: "upstream_receipt_stale",
        reason: `Upstream digest ${key} does not match the current admitted receipt.`,
      });
    }
  }

  for (const claim of publication.claims) {
    if (claim.state !== "supported" && claim.claimClass !== "open_question") {
      blockedClaimIds.add(claim.id);
      findings.push({
        claimId: claim.id,
        state: "claim_support_incomplete",
        reason: "The claim is not in the supported state.",
      });
    }
    if (!claimHasPositiveSupport(claim)) {
      blockedClaimIds.add(claim.id);
      findings.push({
        claimId: claim.id,
        state: "claim_support_incomplete",
        reason: "The claim has no positive support edge.",
      });
    }

    if (claim.claimClass === "mission_evaluation") {
      const hasEvaluation = claim.supportRefs.some(
        (support) =>
          support.relation === "evaluated_by" &&
          Boolean(support.evaluationDigest?.trim()),
      );
      if (!hasEvaluation) {
        blockedClaimIds.add(claim.id);
        findings.push({
          claimId: claim.id,
          state: "claim_support_incomplete",
          reason: "Mission-evaluation claims require an evaluation digest.",
        });
      }
      if (
        claim.scope.scenarioIds === undefined ||
        claim.scope.scenarioIds.length === 0 ||
        claim.scope.metricIds === undefined ||
        claim.scope.metricIds.length === 0
      ) {
        blockedClaimIds.add(claim.id);
        findings.push({
          claimId: claim.id,
          state: "scope_overstated",
          reason: "Mission-evaluation claims require explicit scenario and metric scope.",
        });
      }
      if (claim.prohibitedGeneralizations.length === 0) {
        narrowedClaimIds.add(claim.id);
        findings.push({
          claimId: claim.id,
          state: "scope_overstated",
          reason: "Mission-evaluation claims must name prohibited generalizations.",
        });
      }
    }

    if (claim.claimClass === "cost_comparison") {
      const hasCostSupport = claim.supportRefs.some(
        (support) =>
          support.relation === "costed_by" &&
          (support.costLineIds?.length ?? 0) > 0,
      );
      if (!hasCostSupport || claim.scope.accountingBoundaryComplete !== true) {
        blockedClaimIds.add(claim.id);
        findings.push({
          claimId: claim.id,
          state: "cost_boundary_misaligned",
          reason:
            "Cost-comparison claims require cost-line receipts and a complete aligned accounting boundary.",
        });
      }
    }

    if (
      claim.claimClass === "vendor_parity" &&
      publication.vendorParityState !== "same_fixture_match"
    ) {
      blockedClaimIds.add(claim.id);
      findings.push({
        claimId: claim.id,
        state: "vendor_parity_unsupported",
        reason:
          "Vendor-parity language requires a same-fixture vendor comparison.",
      });
    }

    const redactions = publication.redactions.filter(
      (redaction) => redaction.claimId === claim.id,
    );
    if (redactions.some((redaction) => redaction.evidentiaryEffect === "blocks_claim")) {
      blockedClaimIds.add(claim.id);
      findings.push({
        claimId: claim.id,
        state: "redaction_invalidates_claim",
        reason: "A required redaction removes the evidentiary basis for this claim.",
      });
    }
    if (redactions.some((redaction) => redaction.evidentiaryEffect === "narrows_claim")) {
      narrowedClaimIds.add(claim.id);
    }
  }

  if (
    publication.rightsReview.state === "blocked" ||
    publication.rightsReview.state === "permission_required"
  ) {
    findings.push({
      state: "rights_unresolved",
      reason: "The rights review does not permit the proposed release.",
    });
  }

  if (
    publication.safetyReview.state === "blocked" ||
    (publication.safetyReview.state === "controlled_release_only" &&
      publication.audience === "public")
  ) {
    findings.push({
      state: "safety_review_blocked",
      reason: "The safety review does not permit the selected audience.",
    });
  }

  const passed = findings.length === 0;
  const admittedClaimIds = publication.claims
    .filter((claim) => !blockedClaimIds.has(claim.id))
    .map((claim) => claim.id);

  return {
    passed,
    state: firstState(findings),
    admittedClaimIds,
    blockedClaimIds: [...blockedClaimIds],
    narrowedClaimIds: [...narrowedClaimIds],
    findings,
    requiredActions: findings.map((finding) => finding.reason),
  };
}
