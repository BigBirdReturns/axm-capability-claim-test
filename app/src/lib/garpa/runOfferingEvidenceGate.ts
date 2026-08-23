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
  return claimsForField(packet, field).some(
    (claim) =>
      targets.has(claim.target) &&
      cellsForClaim(packet, claim).some(
        (cell) => targets.has(cell.target) && (!controls || controls.has(cell.control)),
      ),
  );
}

function fieldHasCompleteScope(
  packet: ClaimPacket,
  field: string,
  targets: ReadonlySet<EvidenceTarget>,
): boolean {
  return claimsForField(packet, field).some(
    (claim) =>
      targets.has(claim.target) &&
      cellsForClaim(packet, claim).some(
        (cell) =>
          targets.has(cell.target) && cell.scopeCompleteness === "complete",
      ),
  );
}

function versionResolved(packet: ClaimPacket): boolean {
  const version = packet.subject.offeringVersion?.trim();
  if (!version) return false;
  return claimsForField(packet, "offering_version").some(
    (claim) =>
      claim.target === "offering_version" &&
      cellsForClaim(packet, claim).some(
        (cell) =>
          cell.target === "offering_version" &&
          cell.subjectVersion?.trim() === version,
      ),
  );
}

const SENSITIVE_POLICY: Record<
  string,
  {
    targets: ReadonlySet<EvidenceTarget>;
    controls: ReadonlySet<EvidenceControl>;
    reason: string;
  }
> = {
  deployment_record: {
    targets: new Set(["deployment_occurred"]),
    controls: EXTERNAL_CONTROLS,
    reason:
      "Deployment requires a customer, government, independent, or locally measured record.",
  },
  measured_performance: {
    targets: new Set(["performance_observed", "local_result"]),
    controls: INDEPENDENT_CONTROLS,
    reason: "Measured performance requires independent or local measurement evidence.",
  },
  economic_baseline: {
    targets: new Set(["cost_observed"]),
    controls: EXTERNAL_CONTROLS,
    reason:
      "An economic baseline requires an externally attributable or measured cost record.",
  },
  independent_verification: {
    targets: new Set(["independent_verification", "performance_observed"]),
    controls: INDEPENDENT_CONTROLS,
    reason:
      "Independent verification cannot be supplied by claimant-controlled evidence.",
  },
};

function sensitiveFieldAdmitted(packet: ClaimPacket, field: string): boolean {
  const rule = SENSITIVE_POLICY[field];
  if (!rule) return false;
  return claimsForField(packet, field).some(
    (claim) =>
      rule.targets.has(claim.target) &&
      cellsForClaim(packet, claim).some(
        (cell) => rule.targets.has(cell.target) && rule.controls.has(cell.control),
      ),
  );
}

function disqualifySensitiveClaims(packet: ClaimPacket): EvidenceDisqualification[] {
  const findings: EvidenceDisqualification[] = [];
  for (const claim of packet.claims) {
    const rule = SENSITIVE_POLICY[claim.field];
    if (!rule) continue;
    for (const cell of cellsForClaim(packet, claim)) {
      if (
        !rule.targets.has(claim.target) ||
        !rule.targets.has(cell.target) ||
        !rule.controls.has(cell.control)
      ) {
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
      "Recover a complete stated or observed operating environment, including material constraints.",
    system_boundary:
      "Recover a complete system boundary, including equipment, software, services, operators, infrastructure, and sustainment.",
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
      new Set(["offering_identity"]),
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

  const environment = fieldHasCompleteScope(
    packet,
    "operating_environment",
    new Set(["operating_environment"]),
  );
  (environment ? admittedFields : missingFields).push("operating_environment");

  const boundary = fieldHasCompleteScope(
    packet,
    "system_boundary",
    new Set(["system_boundary"]),
  );
  (boundary ? admittedFields : missingFields).push("system_boundary");

  const disqualifiedCells = disqualifySensitiveClaims(packet);
  const claimedOnlyFields = Object.keys(SENSITIVE_POLICY).filter(
    (field) =>
      claimsForField(packet, field).length > 0 &&
      !sensitiveFieldAdmitted(packet, field),
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
