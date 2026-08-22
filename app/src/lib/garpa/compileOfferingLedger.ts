import { evidenceCellSupportsField } from "../../data/garpaEvidencePolicy";
import type { EvidenceClass, Ledger } from "../../types/audit";
import type {
  ClaimPacket,
  EvidenceCell,
  ScopedOfferingClaim,
} from "../../types/garpa";

const DIRECT_VENUES = new Set<EvidenceCell["venue"]>([
  "claimant_publication",
  "customer_publication",
  "government_record",
  "independent_test",
  "published_benchmark",
  "local_reproduction",
]);

const REPORTED_VENUES = new Set<EvidenceCell["venue"]>([
  "journalistic_report",
  "community_report",
]);

function evidenceClassFor(cells: EvidenceCell[]): EvidenceClass {
  if (cells.length === 0) return "open";
  if (cells.some((cell) => DIRECT_VENUES.has(cell.venue))) return "confirmed";
  if (cells.some((cell) => REPORTED_VENUES.has(cell.venue))) return "reported";
  if (cells.some((cell) => cell.venue === "analyst_derivation")) return "derived";
  return "open";
}

function attributionSafeStatement(
  packet: ClaimPacket,
  claim: ScopedOfferingClaim,
  cells: EvidenceCell[],
): string {
  const claimantControlled =
    claim.target === "claim_was_made" ||
    (cells.length > 0 &&
      cells.every(
        (cell) =>
          cell.control === "claimant_controlled" ||
          cell.control === "commercially_related",
      ));

  return claimantControlled
    ? `${packet.subject.claimant} states: ${claim.statement}`
    : claim.statement;
}

export function compileOfferingLedger(packet: ClaimPacket): Ledger {
  const evidenceById = new Map(packet.evidence.map((cell) => [cell.id, cell]));

  return {
    schemaVersion: 1,
    objectType: "capability_offering",
    targetName: packet.subject.offering,
    context: [
      `Claimant: ${packet.subject.claimant}`,
      `Offering type: ${packet.subject.offeringType}`,
      `Captured: ${packet.capturedAt}`,
      packet.subject.offeringVersion
        ? `Offering version: ${packet.subject.offeringVersion}`
        : "Offering version: unresolved",
    ].join("\n"),
    sources: packet.artifacts.map((artifact) => ({
      id: artifact.id,
      title: artifact.title,
      url: artifact.uri,
      publisher: artifact.publisher,
      date: artifact.publishedAt,
      note: [
        `kind=${artifact.kind}`,
        `captured=${artifact.capturedAt}`,
        artifact.contentDigest ? `digest=${artifact.contentDigest}` : undefined,
        artifact.exactVersion ? `version=${artifact.exactVersion}` : undefined,
        artifact.notes,
      ]
        .filter(Boolean)
        .join("; "),
    })),
    claims: packet.claims.map((claim) => {
      const referencedCells = claim.evidenceCellIds
        .map((id) => evidenceById.get(id))
        .filter((cell): cell is EvidenceCell => Boolean(cell));
      const admissibleCells = referencedCells.filter((cell) =>
        evidenceCellSupportsField(claim.field, cell),
      );
      const sourceIds = [
        ...new Set(admissibleCells.map((cell) => cell.locator.artifactId)),
      ];

      return {
        id: claim.id,
        field: claim.field,
        statement: attributionSafeStatement(packet, claim, admissibleCells),
        evidenceClass: evidenceClassFor(admissibleCells),
        sourceIds,
        notes: [
          claim.scope ? `scope=${claim.scope}` : undefined,
          `target=${claim.target}`,
          `lifecycle=${claim.lifecycle}`,
          claim.limitations.length > 0
            ? `limitations=${claim.limitations.join(" | ")}`
            : undefined,
        ]
          .filter(Boolean)
          .join("; "),
      };
    }),
  };
}
