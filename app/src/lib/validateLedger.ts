import { z } from "zod";
import type { Ledger } from "../types/audit";

// Zod is the house schema-validation idiom (mirrors schemas/*.json). The ledger
// is the mating surface, so validation is strict about the load-bearing shape
// and lenient — but normalized — about the optional analysis annotations.

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  ledger?: Ledger;
}

const objectType = z.enum([
  "product_company",
  "capital_allocator",
  "integrator_platform",
  "ranking_validator_media",
  "government_program_vehicle",
  "claim_only",
]);

const evidenceClass = z.enum([
  "confirmed",
  "reported",
  "derived",
  "judgment",
  "open",
]);

const seamState = z.enum([
  "triggered",
  "not_triggered",
  "unclear",
  "not_applicable",
]);

const contaminationKey = z.enum([
  "cap_table_circularity",
  "validator_circularity",
  "broker_origination",
  "lineage_substitution",
  "independent_demand_inverse",
  "cross_holding_density",
]);

const contaminationBucket = z.enum([
  "clean",
  "mixed",
  "circular",
  "insufficient_data",
]);

const verdictState = z.enum([
  "A_capability_with_proof",
  "B_ahead_of_proof",
  "C_costume_or_proof_substitution",
  "unclassifiable",
  "not_applicable",
]);

const SourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().optional(),
  publisher: z.string().optional(),
  date: z.string().optional(),
  note: z.string().optional(),
});

const ClaimSchema = z.object({
  id: z.string().optional(),
  field: z.string(),
  statement: z.string(),
  evidenceClass,
  confidence: z.number().optional(),
  sourceIds: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

const SeamAnnotationSchema = z.object({
  id: z.string(),
  question: z.string().optional(),
  state: seamState,
  reason: z.string().optional(),
  sourceIds: z.array(z.string()).default([]),
});

const ContaminationComponentSchema = z.object({
  key: contaminationKey,
  present: z.boolean().default(false),
  reason: z.string().optional(),
  sourceIds: z.array(z.string()).default([]),
  internalScore: z.number().optional(),
});

const ContaminationAnnotationSchema = z.object({
  bucket: contaminationBucket.optional(),
  components: z.array(ContaminationComponentSchema).optional(),
});

const VerdictAnnotationSchema = z.object({
  state: verdictState.optional(),
  loop: z.enum(["open", "closed"]).optional(),
  rationale: z.string().optional(),
  largestGap: z.string().optional(),
  tenseOfProof: z.string().optional(),
  whatWouldClearIt: z.string().optional(),
  rootsBeliefSupplier: z.string().optional(),
  rootsValueRetainer: z.string().optional(),
  nextPulls: z.array(z.string()).default([]),
});

const LedgerSchema = z.object({
  schemaVersion: z.literal(1),
  objectType,
  targetName: z.string().min(1, "targetName is required."),
  context: z.string().optional(),
  sources: z.array(SourceSchema),
  claims: z.array(ClaimSchema),
  seams: z.array(SeamAnnotationSchema).optional(),
  contamination: ContaminationAnnotationSchema.optional(),
  verdictNotes: VerdictAnnotationSchema.optional(),
});

// Flatten a ZodError into the flat string[] the UI and tests already expect.
function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export function validateLedger(input: unknown): ValidationResult {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch (e) {
      return { ok: false, errors: [`Invalid JSON: ${(e as Error).message}`] };
    }
  }

  const parsed = LedgerSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: formatIssues(parsed.error) };
  }

  const data = parsed.data;

  // Cross-reference check: every cited source id must exist. (Not expressible
  // in the object schema alone, so it runs here and reports loudly.)
  const sourceIds = new Set(data.sources.map((s) => s.id));
  const errors: string[] = [];
  data.claims.forEach((c, i) => {
    c.sourceIds.forEach((sid) => {
      if (!sourceIds.has(sid)) {
        errors.push(`claims.${i} references unknown source "${sid}".`);
      }
    });
  });
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Normalize into the canonical Ledger (assign stable claim ids by index).
  const ledger: Ledger = {
    schemaVersion: 1,
    objectType: data.objectType,
    targetName: data.targetName,
    context: data.context,
    sources: data.sources,
    claims: data.claims.map((c, i) => ({
      id: c.id ?? `claim_${i}`,
      field: c.field,
      statement: c.statement,
      evidenceClass: c.evidenceClass,
      confidence: c.confidence,
      sourceIds: c.sourceIds,
      notes: c.notes,
    })),
    seams: data.seams,
    contamination: data.contamination,
    verdictNotes: data.verdictNotes,
  };

  return { ok: true, errors: [], ledger };
}
