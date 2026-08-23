import type {
  ClaimPacket,
  EvidenceCell,
  EvidenceControl,
  EvidenceDisqualification,
  EvidenceTarget,
  OfferingEvidenceGateResult,
  ScopedOfferingClaim,
} from "../../types/garpa";

const EXTERNAL_CONTROLS: ReadonlySet<EvidenceControl> = new Set([
  "externally_attributed",
  "independent",
  "local_measured",
]);

const INDEPENDENT_CONTROLS: ReadonlySet<EvidenceControl> = new Set([
  "independent",
  "local_measured",
]);

function cellsForClaim(packet: ClaimPacket, claim: ScopedOfferingClaim): EvidenceCell[] {
  const cells = new Map(packet.evidence.map((cell) => [cell.id, cell]));
  return claim.evidenceCellIds.flatMap((id) => {
    const cell = cells.get(id);
    return cell ? [cell] : [];
  });
}

function claimsForField(packet: ClaimPacket, field: string): ScopedOfferingClaim[] {
  return packet.claims.filter(
    (claim) => claim.field === field && claim.lifecycle !== "withdrawn",
  );
}

function fieldHasEvidence(
  packet: ClaimPacket,
  field: string,
  targets: ReadonlySet<EvidenceTarget>,
  controls?: ReadonlySet<EvidenceControl>,
): boolean {
  return claimsForField(packet, field).some((claim) =>
    cellsForClaim(packet, claim).some(
      (cell) => targets.has(cell.target) && (!controls || controls.has(cell.control)),
    ),
  );
}

function versionResolved(packet: ClaimPacket): boolean {
  if (packet.subject.offeringVersion?.trim()) return true;
  return packet.evidence.some(
    (cell) => cell.target === "offering_version" && Boolean(cell.subjectVersion?.trim()),
  );
}

function disqualifySensitiveClaims(packet: ClaimPacket): EvidenceDisqualification[] {
  const policy: Record<
    string,
    { targets: ReadonlySet<EvidenceTarget>; controls: ReadonlySet<EvidenceControl>; reason: string }
  > = {
    deployment_record: {
      targets: new Set(["deployment_occurred"]),
      controls: EXTERNAL_CONTROLS,
      reason: "Deployment requires a customer, government, independent, or locally measured record.",
    },
    measured_performance: {
      targets: new Set(["performance_observed", "local_result"]),
      controls: INDEPENDENT_CONTROLS,
      reason: "Measured performance requires independent or local measurement evidence.",
    },
    economic_baseline: {
      targets: new Set(["cost_observed"]),
      controls: EXTERNAL_CONTROLS,
      reason: "An economic baseline requires an externally attributable or measured cost record.",
    },
    independent_verification: {
      targets: new Set(["independent_verification", "performance_observed"]),
      controls: INDEPENDENT_CONTROLS,
      reason: "Independent verification cannot be supplied by claimant-controlled evidence.",
    },
  };

  const findings: EvidenceDisqualification[] = [];
  for (const claim of packet.claims) {
    const rule = policy[claim.field];
    if (!rule) continue;
    for (const cell of cellsForClaim(packet, claim)) {
      if (!rule.targets.has(cell.target) || !rule.controls.has(cell.control)) {
        findings.push({
          evidenceCellId: cell.id,
          claimId: claim.id,
          field: claim.field,
          reason: rule.reason,
        });
      }
    }
  }
  return findings;
}

function pullFor(field: string): string {
  const pulls: Record<string, string> = {
    offering_identity:
      "Recover an artifact that identifies the claimant, offering, and offering type.",
    offering_version:
      "Resolve the exact product, service, or system version being evaluated.",
    advertised_outcome:
      "Recover the exact advertised customer outcome and its source locator.",
    operating_environment:
      "Recover the stated or observed operating environment, including material constraints.",
    system_boundary:
      "Recover the system boundary, including equipment, software, services, operators, infrastructure, and sustainment.",
  };
  return pulls[field] ?? `Recover admissible evidence for ${field}.`;
}

export function runOfferingEvidenceGate(packet: ClaimPacket): OfferingEvidenceGateResult {
  const admittedFields: string[] = [];
  const missingFields: string[] = [];

  const identity =
    Boolean(packet.subject.claimant.trim() && packet.subject.offering.trim()) &&
    fieldHasEvidence(
      packet,
      "offering_identity",
      new Set(["offering_identity", "claim_was_made"]),
    );
  (identity ? admittedFields : missingFields).push("offering_identity");

  const version = versionResolved(packet);
  (version ? admittedFields : missingFields).push("offering_version");

  const outcome = fieldHasEvidence(
    packet,
    "advertised_outcome",
    new Set(["claim_was_made", "advertised_outcome", "operator_need"]),
  );
  (outcome ? admittedFields : missingFields).push("advertised_outcome");

  const environment = fieldHasEvidence(
    packet,
    "operating_environment",
    new Set(["operating_environment"]),
  );
  (environment ? admittedFields : missingFields).push("operating_environment");

  const boundary = fieldHasEvidence(
    packet,
    "system_boundary",
    new Set(["system_boundary"]),
  );
  (boundary ? admittedFields : missingFields).push("system_boundary");

  const disqualifiedCells = disqualifySensitiveClaims(packet);
  const disqualifiedClaimIds = new Set(disqualifiedCells.map((finding) => finding.claimId));
  const claimedOnlyFields = Array.from(
    new Set(
      packet.claims
        .filter((claim) => disqualifiedClaimIds.has(claim.id))
        .map((claim) => claim.field),
    ),
  );

  const state = !identity
    ? "insufficient_identity"
    : !version
      ? "version_unresolved"
      : !outcome
        ? "claim_only"
        : !environment
          ? "environment_unresolved"
          : !boundary
            ? "system_boundary_missing"
            : "admitted_for_goal";

  return {
    state,
    passed: state === "admitted_for_goal",
    admittedFields,
    claimedOnlyFields,
    missingFields,
    disqualifiedCells,
    pullList: missingFields.map(pullFor),
  };
}
