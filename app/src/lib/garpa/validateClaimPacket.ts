import { z } from "zod";
import type {
  ClaimPacket,
  GarpaValidationResult,
  MissionOutcome,
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
  "advertised_outcome",
  "claimed_mechanism",
  "deployment_occurred",
  "performance_observed",
  "cost_observed",
  "operating_environment",
  "system_boundary",
  "independent_verification",
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

const evidenceClass = z.enum([
  "confirmed",
  "reported",
  "derived",
  "judgment",
  "open",
]);

const basisState = z.enum([
  "explicitly_stated",
  "externally_supported",
  "derived",
  "analyst_hypothesis",
  "open",
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
    notes: z.array(z.string()).optional(),
  })
  .strict();

const ArtifactLocatorSchema = z
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
    locator: ArtifactLocatorSchema,
    subjectVersion: z.string().optional(),
    hardware: z.array(z.string()).optional(),
    software: z.array(z.string()).optional(),
    fixture: z.string().optional(),
    environment: z.string().optional(),
    metric: z.string().optional(),
    method: z.string().optional(),
    scopeCompleteness: z.enum(["complete", "partial", "unknown"]).optional(),
    supports: z.array(z.string()).default([]),
    limitations: z.array(z.string()).default([]),
    conflictsWith: z.array(z.string()).optional(),
  })
  .strict()
  .superRefine((cell, ctx) => {
    if (cell.target === "local_result" && !cell.fixture?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fixture"],
        message: "local_result evidence requires a fixture.",
      });
    }
    if (cell.target === "local_result" && !cell.method?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["method"],
        message: "local_result evidence requires a method.",
      });
    }
    if (cell.control === "local_measured" && cell.venue !== "local_reproduction") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["venue"],
        message: "local_measured evidence must use the local_reproduction venue.",
      });
    }
  });

const OfferingSubjectSchema = z
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
  .strict();

const ScopedOfferingClaimSchema = z
  .object({
    id: z.string().min(1),
    field: z.string().min(1),
    statement: z.string().min(1),
    target: evidenceTarget,
    evidenceClass,
    evidenceCellIds: z.array(z.string()).default([]),
    scope: z.string().optional(),
    lifecycle: z.enum([
      "active",
      "superseded",
      "withdrawn",
      "conflicted",
      "unknown",
    ]),
    limitations: z.array(z.string()).default([]),
  })
  .strict();

const ClaimConflictSchema = z
  .object({
    id: z.string().min(1),
    claimIds: z.array(z.string()).min(2),
    description: z.string().min(1),
  })
  .strict();

const ClaimPacketSchema = z
  .object({
    schemaVersion: z.literal(1),
    subject: OfferingSubjectSchema,
    artifacts: z.array(ArtifactSchema).min(1),
    evidence: z.array(EvidenceCellSchema),
    claims: z.array(ScopedOfferingClaimSchema),
    conflicts: z.array(ClaimConflictSchema).default([]),
    capturedAt: z.string().min(1),
  })
  .strict();

const EvidenceBoundValueSchema = z
  .object({
    value: z.string().optional(),
    basis: basisState,
    evidenceCellIds: z.array(z.string()).default([]),
    limitations: z.array(z.string()).default([]),
  })
  .strict();

const OutcomeMetricSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    unit: z.string().optional(),
    comparator: z.enum(["gte", "lte", "range", "boolean", "categorical"]),
    threshold: z.union([z.number(), z.string(), z.boolean()]).optional(),
    lowerBound: z.number().optional(),
    upperBound: z.number().optional(),
    baseline: z.union([z.number(), z.string(), z.boolean()]).optional(),
    basis: basisState,
    evidenceCellIds: z.array(z.string()).default([]),
    limitations: z.array(z.string()).default([]),
  })
  .strict()
  .superRefine((metric, ctx) => {
    if (metric.comparator === "range") {
      if (metric.lowerBound === undefined || metric.upperBound === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "range metrics require lowerBound and upperBound.",
        });
      }
      return;
    }
    if (metric.threshold === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["threshold"],
        message: `${metric.comparator} metrics require a threshold.`,
      });
    }
  });

const MissionOutcomeSchema = z
  .object({
    schemaVersion: z.literal(1),
    operator: EvidenceBoundValueSchema,
    protectedOrAffectedObject: EvidenceBoundValueSchema,
    problemOrThreat: EvidenceBoundValueSchema,
    desiredStateChange: EvidenceBoundValueSchema,
    operatingEnvironment: EvidenceBoundValueSchema,
    timeAndCoverageRequirement: EvidenceBoundValueSchema,
    successMetrics: z.array(OutcomeMetricSchema),
    economicConstraint: EvidenceBoundValueSchema.optional(),
    exclusions: z.array(z.string()).default([]),
  })
  .strict();

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

function parseInput(input: unknown): GarpaValidationResult<unknown> {
  if (typeof input !== "string") return { ok: true, errors: [], value: input };
  try {
    return { ok: true, errors: [], value: JSON.parse(input) as unknown };
  } catch (error) {
    return {
      ok: false,
      errors: [`Invalid JSON: ${(error as Error).message}`],
    };
  }
}

function duplicateIds(items: { id: string }[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  return [...duplicates];
}

export function validateClaimPacket(input: unknown): GarpaValidationResult<ClaimPacket> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };

  const parsed = ClaimPacketSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const packet = parsed.data as ClaimPacket;
  const errors: string[] = [];

  for (const [label, items] of [
    ["artifacts", packet.artifacts],
    ["evidence", packet.evidence],
    ["claims", packet.claims],
    ["conflicts", packet.conflicts],
  ] as const) {
    for (const id of duplicateIds(items)) errors.push(`${label} contains duplicate id "${id}".`);
  }

  const artifactIds = new Set(packet.artifacts.map((artifact) => artifact.id));
  const evidenceIds = new Set(packet.evidence.map((cell) => cell.id));
  const claimIds = new Set(packet.claims.map((claim) => claim.id));

  packet.evidence.forEach((cell, index) => {
    if (!artifactIds.has(cell.locator.artifactId)) {
      errors.push(
        `evidence.${index}.locator references unknown artifact "${cell.locator.artifactId}".`,
      );
    }
    for (const claimId of cell.supports) {
      if (!claimIds.has(claimId)) {
        errors.push(`evidence.${index}.supports references unknown claim "${claimId}".`);
      }
    }
    for (const conflictId of cell.conflictsWith ?? []) {
      if (!evidenceIds.has(conflictId)) {
        errors.push(`evidence.${index}.conflictsWith references unknown evidence "${conflictId}".`);
      }
    }
  });

  packet.claims.forEach((claim, index) => {
    for (const evidenceId of claim.evidenceCellIds) {
      if (!evidenceIds.has(evidenceId)) {
        errors.push(`claims.${index} references unknown evidence "${evidenceId}".`);
      }
    }
  });

  packet.conflicts.forEach((conflict, index) => {
    for (const claimId of conflict.claimIds) {
      if (!claimIds.has(claimId)) {
        errors.push(`conflicts.${index} references unknown claim "${claimId}".`);
      }
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: packet };
}

function outcomeEvidenceIds(outcome: MissionOutcome): string[] {
  const values = [
    outcome.operator,
    outcome.protectedOrAffectedObject,
    outcome.problemOrThreat,
    outcome.desiredStateChange,
    outcome.operatingEnvironment,
    outcome.timeAndCoverageRequirement,
    ...(outcome.economicConstraint ? [outcome.economicConstraint] : []),
  ];
  return [
    ...values.flatMap((value) => value.evidenceCellIds),
    ...outcome.successMetrics.flatMap((metric) => metric.evidenceCellIds),
  ];
}

export function validateMissionOutcome(
  input: unknown,
  packet?: ClaimPacket,
): GarpaValidationResult<MissionOutcome> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };

  const parsed = MissionOutcomeSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const outcome = parsed.data as MissionOutcome;
  const errors: string[] = [];
  for (const id of duplicateIds(outcome.successMetrics)) {
    errors.push(`successMetrics contains duplicate id "${id}".`);
  }

  if (packet) {
    const evidenceIds = new Set(packet.evidence.map((cell) => cell.id));
    for (const evidenceId of outcomeEvidenceIds(outcome)) {
      if (!evidenceIds.has(evidenceId)) {
        errors.push(`mission outcome references unknown evidence "${evidenceId}".`);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: outcome };
}
