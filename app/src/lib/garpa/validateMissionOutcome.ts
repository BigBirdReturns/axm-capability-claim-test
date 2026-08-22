import { z } from "zod";
import type {
  ClaimPacket,
  MissionOutcome,
  MissionOutcomeValidationResult,
} from "../../types/garpa";

const basisState = z.enum([
  "explicitly_stated",
  "externally_supported",
  "derived",
  "analyst_hypothesis",
  "open",
]);

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
    threshold: z.union([z.number(), z.string()]).optional(),
    baseline: z.union([z.number(), z.string()]).optional(),
    basis: basisState,
    evidenceCellIds: z.array(z.string()).default([]),
    limitations: z.array(z.string()).default([]),
  })
  .strict();

const MissionOutcomeSchema = z
  .object({
    schemaVersion: z.literal(1),
    operator: EvidenceBoundValueSchema,
    protectedOrAffectedObject: EvidenceBoundValueSchema,
    problemOrThreat: EvidenceBoundValueSchema,
    desiredStateChange: EvidenceBoundValueSchema,
    operatingEnvironment: EvidenceBoundValueSchema,
    timeAndCoverageRequirement: EvidenceBoundValueSchema,
    baseline: EvidenceBoundValueSchema,
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

export function validateMissionOutcome(
  input: unknown,
  claimPacket: ClaimPacket,
): MissionOutcomeValidationResult {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch (error) {
      return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
    }
  }

  const parsed = MissionOutcomeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: formatIssues(parsed.error) };
  }

  const missionOutcome = parsed.data as MissionOutcome;
  const validEvidenceIds = new Set(claimPacket.evidence.map((cell) => cell.id));
  const errors: string[] = [];

  const checkEvidenceRefs = (
    path: string,
    basis: MissionOutcome["operator"]["basis"],
    evidenceCellIds: string[],
  ) => {
    evidenceCellIds.forEach((id) => {
      if (!validEvidenceIds.has(id)) {
        errors.push(`${path} references unknown evidence cell "${id}".`);
      }
    });
    if (basis !== "open" && evidenceCellIds.length === 0) {
      errors.push(`${path} basis "${basis}" requires at least one evidence cell.`);
    }
  };

  const values: Array<[string, MissionOutcome["operator"]]> = [
    ["operator", missionOutcome.operator],
    ["protectedOrAffectedObject", missionOutcome.protectedOrAffectedObject],
    ["problemOrThreat", missionOutcome.problemOrThreat],
    ["desiredStateChange", missionOutcome.desiredStateChange],
    ["operatingEnvironment", missionOutcome.operatingEnvironment],
    ["timeAndCoverageRequirement", missionOutcome.timeAndCoverageRequirement],
    ["baseline", missionOutcome.baseline],
  ];
  if (missionOutcome.economicConstraint) {
    values.push(["economicConstraint", missionOutcome.economicConstraint]);
  }

  values.forEach(([path, value]) =>
    checkEvidenceRefs(path, value.basis, value.evidenceCellIds),
  );

  const metricIds = new Set<string>();
  missionOutcome.successMetrics.forEach((metric, index) => {
    if (metricIds.has(metric.id)) {
      errors.push(`successMetrics.${index} duplicates metric id "${metric.id}".`);
    }
    metricIds.add(metric.id);
    checkEvidenceRefs(
      `successMetrics.${index}`,
      metric.basis,
      metric.evidenceCellIds,
    );
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], missionOutcome };
}
