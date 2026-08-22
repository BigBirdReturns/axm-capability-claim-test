import { z } from "zod";
import { evidenceCellSupportsField, OFFERING_FIELD_TARGETS } from "../../data/garpaEvidencePolicy";
import type {
  ClaimPacket,
  ClaimPacketValidationResult,
  EvidenceCell,
} from "../../types/garpa";

const artifactKind = z.enum([
  "social_post",
  "web_page",
  "article",
  "pitch_deck",
  "datasheet",
  "procurement_record",
  "contract_record",
  "patent",
  "paper",
  "benchmark",
  "video",
  "transcript",
  "image",
  "local_test",
  "other",
]);

const evidenceTarget = z.enum([
  "claim_was_made",
  "offering_identity",
  "offering_version",
  "operator_need",
  "deployment_occurred",
  "performance_observed",
  "cost_observed",
  "system_boundary",
  "ownership_or_lock_in",
  "local_result",
  "other",
]);

const evidenceVenue = z.enum([
  "claimant_publication",
  "customer_publication",
  "government_record",
  "independent_test",
  "published_benchmark",
  "journalistic_report",
  "community_report",
  "local_reproduction",
  "analyst_derivation",
]);

const evidenceControl = z.enum([
  "claimant_controlled",
  "commercially_related",
  "externally_attributed",
  "independent",
  "local_measured",
  "unknown",
]);

const offeringClaimField = z.enum([
  "offering_identity",
  "offering_version",
  "advertised_outcome",
  "claimed_mechanism",
  "advertised_economics",
  "named_operator_need",
  "deployment_record",
  "measured_performance",
  "economic_baseline",
  "operating_environment",
  "system_boundary",
  "independent_verification",
  "ownership_and_lock_in",
]);

const ArtifactSchema = z
  .object({
    id: z.string().min(1),
    kind: artifactKind,
    title: z.string().min(1),
    uri: z.string().optional(),
    publisher: z.string().optional(),
    author: z.string().optional(),
    publishedAt: z.string().optional(),
    capturedAt: z.string().min(1),
    contentDigest: z.string().optional(),
    exactVersion: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();

const LocatorSchema = z
  .object({
    artifactId: z.string().min(1),
    page: z.number().int().positive().optional(),
    timestampStart: z.string().optional(),
    timestampEnd: z.string().optional(),
    section: z.string().optional(),
    quotedText: z.string().optional(),
    description: z.string().optional(),
  })
  .strict();

const EvidenceCellSchema = z
  .object({
    id: z.string().min(1),
    target: evidenceTarget,
    venue: evidenceVenue,
    control: evidenceControl,
    locator: LocatorSchema,
    statement: z.string().min(1),
    subjectVersion: z.string().optional(),
    fixture: z.string().optional(),
    environment: z.string().optional(),
    metric: z.string().optional(),
    method: z.string().optional(),
    limitations: z.array(z.string()).default([]),
  })
  .strict();

const ClaimSchema = z
  .object({
    id: z.string().min(1),
    field: offeringClaimField,
    target: evidenceTarget,
    statement: z.string().min(1),
    scope: z.string().optional(),
    evidenceCellIds: z.array(z.string()).default([]),
    lifecycle: z.enum(["active", "superseded", "withdrawn", "conflicted", "unknown"]),
    limitations: z.array(z.string()).default([]),
  })
  .strict();

const ClaimPacketSchema = z
  .object({
    schemaVersion: z.literal(1),
    subject: z
      .object({
        claimant: z.string().min(1),
        organization: z.string().optional(),
        offering: z.string().min(1),
        offeringVersion: z.string().optional(),
        offeringType: z.enum([
          "product",
          "service",
          "system",
          "platform",
          "program",
          "architecture",
        ]),
      })
      .strict(),
    artifacts: z.array(ArtifactSchema).min(1),
    evidence: z.array(EvidenceCellSchema),
    claims: z.array(ClaimSchema),
    conflicts: z.array(
      z
        .object({
          id: z.string().min(1),
          claimIds: z.array(z.string()).min(2),
          description: z.string().min(1),
        })
        .strict(),
    ),
    capturedAt: z.string().min(1),
  })
  .strict();

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

function duplicateIds(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return [...duplicates];
}

export function validateClaimPacket(input: unknown): ClaimPacketValidationResult {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch (error) {
      return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
    }
  }

  const parsed = ClaimPacketSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: formatIssues(parsed.error) };
  }

  const packet = parsed.data as ClaimPacket;
  const errors: string[] = [];

  duplicateIds(packet.artifacts.map((artifact) => artifact.id)).forEach((id) =>
    errors.push(`Duplicate artifact id "${id}".`),
  );
  duplicateIds(packet.evidence.map((cell) => cell.id)).forEach((id) =>
    errors.push(`Duplicate evidence id "${id}".`),
  );
  duplicateIds(packet.claims.map((claim) => claim.id)).forEach((id) =>
    errors.push(`Duplicate claim id "${id}".`),
  );
  duplicateIds(packet.conflicts.map((conflict) => conflict.id)).forEach((id) =>
    errors.push(`Duplicate conflict id "${id}".`),
  );

  const artifactIds = new Set(packet.artifacts.map((artifact) => artifact.id));
  const evidenceById = new Map(packet.evidence.map((cell) => [cell.id, cell]));
  const claimIds = new Set(packet.claims.map((claim) => claim.id));

  packet.evidence.forEach((cell, index) => {
    if (!artifactIds.has(cell.locator.artifactId)) {
      errors.push(
        `evidence.${index} references unknown artifact "${cell.locator.artifactId}".`,
      );
    }
    if (
      cell.target === "local_result" &&
      (cell.venue !== "local_reproduction" || !cell.fixture?.trim() || !cell.method?.trim())
    ) {
      errors.push(
        `evidence.${index} local_result requires local_reproduction venue, fixture, and method.`,
      );
    }
    if (cell.control === "independent" && cell.venue === "claimant_publication") {
      errors.push(
        `evidence.${index} cannot be independent when the venue is claimant_publication.`,
      );
    }
  });

  packet.claims.forEach((claim, index) => {
    if (!OFFERING_FIELD_TARGETS[claim.field].includes(claim.target)) {
      errors.push(
        `claims.${index} target "${claim.target}" cannot support field "${claim.field}".`,
      );
    }

    const cells: EvidenceCell[] = [];
    claim.evidenceCellIds.forEach((id) => {
      const cell = evidenceById.get(id);
      if (!cell) {
        errors.push(`claims.${index} references unknown evidence cell "${id}".`);
      } else {
        cells.push(cell);
      }
    });

    if (
      cells.length > 0 &&
      !cells.some((cell) => evidenceCellSupportsField(claim.field, cell))
    ) {
      errors.push(
        `claims.${index} has evidence, but none is admissible for field "${claim.field}".`,
      );
    }
  });

  packet.conflicts.forEach((conflict, index) => {
    conflict.claimIds.forEach((claimId) => {
      if (!claimIds.has(claimId)) {
        errors.push(`conflicts.${index} references unknown claim "${claimId}".`);
      }
    });
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], claimPacket: packet };
}
