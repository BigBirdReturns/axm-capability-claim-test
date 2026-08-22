import { evidenceCellSupportsField } from "../../data/garpaEvidencePolicy";
import type {
  ClaimPacket,
  EvidenceCell,
  OfferingClaimField,
  OfferingEvidenceGateResult,
} from "../../types/garpa";

const ARCHITECTURE_FIELDS: readonly OfferingClaimField[] = [
  "offering_version",
  "named_operator_need",
  "operating_environment",
  "system_boundary",
  "economic_baseline",
];

const PULLS: Partial<Record<OfferingClaimField, string>> = {
  offering_identity:
    "Identify the exact claimant and offering represented by the artifact.",
  offering_version:
    "Resolve the exact offering version, launch configuration, or dated product state being evaluated.",
  advertised_outcome:
    "Extract the outcome the claimant says the customer receives, separately from the named mechanism.",
  named_operator_need:
    "Find an operator, customer, or authoritative mission record stating the need the offering is meant to satisfy.",
  operating_environment:
    "Resolve the operating environment: site geometry, conditions, duration, load, and relevant constraints.",
  system_boundary:
    "Resolve the complete system boundary, including equipment, software, communications, staffing, maintenance, and external services.",
  economic_baseline:
    "Obtain a numerical comparator with the same accounting boundary, period, staffing model, and mission denominator.",
};

function referencedCells(packet: ClaimPacket, evidenceCellIds: string[]): EvidenceCell[] {
  const byId = new Map(packet.evidence.map((cell) => [cell.id, cell]));
  return evidenceCellIds
    .map((id) => byId.get(id))
    .filter((cell): cell is EvidenceCell => Boolean(cell));
}

export function runOfferingEvidenceGate(
  packet: ClaimPacket,
): OfferingEvidenceGateResult {
  const admitted = new Set<OfferingClaimField>();
  const claimedOnly = new Set<OfferingClaimField>();

  packet.claims.forEach((claim) => {
    const cells = referencedCells(packet, claim.evidenceCellIds).filter((cell) =>
      evidenceCellSupportsField(claim.field, cell),
    );
    if (cells.length === 0) return;
    admitted.add(claim.field);
    if (
      cells.every(
        (cell) =>
          cell.control === "claimant_controlled" ||
          cell.control === "commercially_related",
      )
    ) {
      claimedOnly.add(claim.field);
    }
  });

  if (packet.subject.offeringVersion?.trim()) admitted.add("offering_version");
  if (packet.subject.claimant.trim() && packet.subject.offering.trim()) {
    admitted.add("offering_identity");
  }

  const goalExtractionMissing = ([
    "offering_identity",
    "advertised_outcome",
  ] as const).filter((field) => !admitted.has(field));

  const architectureMissing = ARCHITECTURE_FIELDS.filter(
    (field) => !admitted.has(field),
  );

  const passed = goalExtractionMissing.length === 0;
  const architecturePreconditionsPassed =
    passed && architectureMissing.length === 0;
  const missingFields = [...new Set([...goalExtractionMissing, ...architectureMissing])];
  const blockingReasons = missingFields.map(
    (field) => `Offering evidence missing: ${field}.`,
  );
  const pullList = missingFields.map(
    (field) => PULLS[field] ?? `Retrieve admissible evidence for ${field}.`,
  );

  return {
    passed,
    architecturePreconditionsPassed,
    admittedFields: [...admitted],
    claimedOnlyFields: [...claimedOnly],
    missingFields,
    blockingReasons,
    pullList,
  };
}
