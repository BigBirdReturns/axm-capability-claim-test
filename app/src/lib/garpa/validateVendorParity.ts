import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type { VendorParityRequest } from "../../types/garpaParity";

const evidenceControl = z.enum([
  "claimant_controlled",
  "commercially_related",
  "externally_attributed",
  "independent",
  "local_measured",
  "unknown",
]);

const missionState = z.enum([
  "matched",
  "bounded_match",
  "partial",
  "failed",
  "incomparable",
  "unassessed",
]);

const costCategory = z.enum([
  "hardware",
  "software",
  "services",
  "custom_code",
  "fabrication",
  "integration_labor",
  "operator_labor",
  "training",
  "test_equipment",
  "qualification",
  "maintenance",
  "spares",
  "communications",
  "facilities",
  "energy",
  "regulatory",
  "replacement",
  "contingency",
]);

const ComparatorSchema = z
  .object({
    metricId: z.string().min(1),
    label: z.string().min(1),
    essential: z.boolean(),
    direction: z.enum([
      "higher_is_better",
      "lower_is_better",
      "absolute_delta",
      "boolean_equal",
      "categorical_equal",
    ]),
    requiredUnit: z.string().optional(),
    absoluteTolerance: z.number().nonnegative().optional(),
    relativeTolerance: z.number().nonnegative().optional(),
    requiresAccountingAlignment: z.boolean().optional(),
  })
  .strict()
  .superRefine((comparator, ctx) => {
    if (
      ["higher_is_better", "lower_is_better", "absolute_delta"].includes(
        comparator.direction,
      ) &&
      !comparator.requiredUnit?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requiredUnit"],
        message: "Numeric parity comparators require a unit.",
      });
    }
  });

const ObservationSchema = z
  .object({
    id: z.string().min(1),
    subject: z.enum(["garpa", "vendor"]),
    subjectVersion: z.string().optional(),
    metricId: z.string().min(1),
    scenarioId: z.string().min(1),
    fixtureDigest: z.string().optional(),
    methodDigest: z.string().optional(),
    buildReceiptDigest: z.string().optional(),
    qualificationContractDigest: z.string().optional(),
    value: z.union([z.number(), z.string(), z.boolean()]),
    unit: z.string().optional(),
    evidenceControl,
    evidenceArtifactIds: z.array(z.string().min(1)).min(1),
    limitations: z.array(z.string()),
  })
  .strict();

const ScenarioComparisonSchema = z
  .object({
    id: z.string().min(1),
    garpaScenarioId: z.string().min(1),
    vendorScenarioId: z.string().min(1),
    state: z.enum([
      "same_fixture",
      "normalized",
      "reported_only",
      "not_comparable",
    ]),
    normalizationMethod: z.string().optional(),
    reasons: z.array(z.string()),
  })
  .strict()
  .superRefine((comparison, ctx) => {
    if (comparison.state === "normalized" && !comparison.normalizationMethod?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["normalizationMethod"],
        message: "Normalized scenario comparisons require a method.",
      });
    }
  });

const AccountingBoundarySchema = z
  .object({
    id: z.string().min(1),
    subject: z.enum(["garpa", "vendor"]),
    currency: z.string().min(3),
    priceDate: z.string().min(1),
    evaluationPeriod: z.string().min(1),
    includes: z.array(costCategory),
    exclusions: z.array(z.string()),
    missionDenominator: z.string().min(1),
    evidenceArtifactIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

const AccountingComparisonSchema = z
  .object({
    garpaBoundaryId: z.string().optional(),
    vendorBoundaryId: z.string().optional(),
    state: z.enum([
      "aligned",
      "partially_aligned",
      "misaligned",
      "not_supplied",
    ]),
    reasons: z.array(z.string()),
  })
  .strict();

const Schema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    vendorOffering: z.string().min(1),
    vendorVersion: z.string().optional(),
    garpaMissionState: missionState,
    garpaBuildReceiptDigest: z.string().min(1),
    garpaQualificationContractDigest: z.string().min(1),
    requiredMetricIds: z.array(z.string().min(1)).min(1),
    essentialMetricIds: z.array(z.string().min(1)).min(1),
    comparators: z.array(ComparatorSchema).min(1),
    observations: z.array(ObservationSchema),
    scenarioComparisons: z.array(ScenarioComparisonSchema),
    accountingBoundaries: z.array(AccountingBoundarySchema),
    accountingComparison: AccountingComparisonSchema.optional(),
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
    return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
  }
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

export function validateVendorParityRequest(
  input: unknown,
): GarpaValidationResult<VendorParityRequest> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };

  const parsed = Schema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const request = parsed.data;
  const errors: string[] = [];
  const requiredMetricIds = new Set(request.requiredMetricIds);
  const essentialMetricIds = new Set(request.essentialMetricIds);

  for (const id of duplicates(request.requiredMetricIds)) {
    errors.push(`requiredMetricIds contains duplicate metric "${id}".`);
  }
  for (const id of duplicates(request.essentialMetricIds)) {
    errors.push(`essentialMetricIds contains duplicate metric "${id}".`);
  }
  for (const id of request.essentialMetricIds) {
    if (!requiredMetricIds.has(id)) {
      errors.push(`Essential metric "${id}" is not a required metric.`);
    }
  }

  const comparatorIds = request.comparators.map((item) => item.metricId);
  for (const id of duplicates(comparatorIds)) {
    errors.push(`comparators contains duplicate metric "${id}".`);
  }
  for (const id of request.requiredMetricIds) {
    if (!comparatorIds.includes(id)) {
      errors.push(`Required metric "${id}" has no parity comparator.`);
    }
  }
  for (const comparator of request.comparators) {
    if (!requiredMetricIds.has(comparator.metricId)) {
      errors.push(`Comparator references non-required metric "${comparator.metricId}".`);
    }
    if (comparator.essential !== essentialMetricIds.has(comparator.metricId)) {
      errors.push(
        `Comparator essential flag disagrees with essentialMetricIds for "${comparator.metricId}".`,
      );
    }
  }

  for (const id of duplicates(request.observations.map((item) => item.id))) {
    errors.push(`observations contains duplicate id "${id}".`);
  }
  for (const observation of request.observations) {
    if (!requiredMetricIds.has(observation.metricId)) {
      errors.push(`Observation ${observation.id} references unknown metric "${observation.metricId}".`);
    }
    if (observation.subject === "garpa") {
      if (observation.buildReceiptDigest !== request.garpaBuildReceiptDigest) {
        errors.push(`GARPA observation ${observation.id} references the wrong build receipt.`);
      }
      if (
        observation.qualificationContractDigest !==
        request.garpaQualificationContractDigest
      ) {
        errors.push(`GARPA observation ${observation.id} references the wrong qualification contract.`);
      }
      if (![
        "independent",
        "local_measured",
      ].includes(observation.evidenceControl)) {
        errors.push(`GARPA observation ${observation.id} is not measured evidence.`);
      }
    }
    if (
      observation.subject === "vendor" &&
      request.vendorVersion &&
      observation.subjectVersion !== request.vendorVersion
    ) {
      errors.push(`Vendor observation ${observation.id} does not match the evaluated vendor version.`);
    }
  }

  for (const id of duplicates(request.scenarioComparisons.map((item) => item.id))) {
    errors.push(`scenarioComparisons contains duplicate id "${id}".`);
  }

  const boundaryIds = new Set(request.accountingBoundaries.map((item) => item.id));
  for (const id of duplicates(request.accountingBoundaries.map((item) => item.id))) {
    errors.push(`accountingBoundaries contains duplicate id "${id}".`);
  }
  if (request.accountingComparison) {
    const { garpaBoundaryId, vendorBoundaryId, state } = request.accountingComparison;
    if (state !== "not_supplied") {
      if (!garpaBoundaryId || !boundaryIds.has(garpaBoundaryId)) {
        errors.push("accountingComparison references an unknown GARPA boundary.");
      }
      if (!vendorBoundaryId || !boundaryIds.has(vendorBoundaryId)) {
        errors.push("accountingComparison references an unknown vendor boundary.");
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: request as VendorParityRequest };
}
