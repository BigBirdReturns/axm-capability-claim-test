import { z } from "zod";
import type {
  ClaimPacket,
  GarpaValidationResult,
  MissionOutcome,
} from "../../types/garpa";
import type { CandidateArchitecture } from "../../types/garpaArchitecture";
import type { QualificationContract } from "../../types/garpaQualification";

const VenueClass = z.enum([
  "simulation",
  "recorded_replay",
  "bench",
  "controlled_field",
  "operational",
]);

const InstrumentationSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    modelOrVersion: z.string().min(1),
    quantitiesMeasured: z.array(z.string()).min(1),
    samplingRate: z.string().optional(),
    accuracy: z.string().optional(),
    clockSource: z.string().min(1),
    calibrationState: z.enum([
      "current",
      "expired",
      "not_required",
      "unknown",
    ]),
    calibrationEvidenceIds: z.array(z.string()),
    dataFormat: z.string().min(1),
    storagePath: z.string().min(1),
  })
  .strict();

const ScenarioSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    purpose: z.string().min(1),
    venueClass: VenueClass,
    protectedOrAffectedObject: z.string().min(1),
    inputOrThreatProfile: z.array(z.string()).min(1),
    environment: z.record(z.string()),
    duration: z.string().min(1),
    coverageGeometry: z.string().min(1),
    loadProfile: z.string().min(1),
    concurrencyProfile: z.string().min(1),
    operatorConditions: z
      .object({
        staffing: z.string().min(1),
        training: z.string().min(1),
        priorKnowledge: z.string().min(1),
        permittedIntervention: z.array(z.string()),
      })
      .strict(),
    degradedConditions: z.array(z.string()),
    excludedConditions: z.array(z.string()),
    fixtureIds: z.array(z.string()).min(1),
    metricIds: z.array(z.string()).min(1),
    instrumentationIds: z.array(z.string()).min(1),
    authorizationId: z.string().optional(),
    activeEffect: z.boolean(),
    evidenceCellIds: z.array(z.string()),
    assumptions: z.array(z.string()),
  })
  .strict();

const MetricSchema = z
  .object({
    id: z.string().min(1),
    missionMetricIds: z.array(z.string()),
    riskIds: z.array(z.string()),
    residualIds: z.array(z.string()),
    name: z.string().min(1),
    criticality: z.enum(["essential", "secondary", "diagnostic"]),
    quantity: z.string().min(1),
    unit: z.string().optional(),
    direction: z.enum([
      "higher_is_better",
      "lower_is_better",
      "inside_range",
      "boolean",
      "categorical",
    ]),
    threshold: z.union([z.number(), z.string(), z.boolean()]).optional(),
    lowerBound: z.number().optional(),
    upperBound: z.number().optional(),
    baseline: z.union([z.number(), z.string(), z.boolean()]).optional(),
    measurementMethod: z.string().min(1),
    instrumentationIds: z.array(z.string()).min(1),
    samplingMethod: z.string().min(1),
    requiredRuns: z.number().int().positive(),
    aggregation: z.enum([
      "all_runs",
      "minimum",
      "maximum",
      "mean",
      "median",
      "percentile",
      "proportion",
    ]),
    aggregationParameter: z.number().optional(),
    allowedUncertainty: z.string().min(1),
    failureCondition: z.string().min(1),
    evidenceCellIds: z.array(z.string()),
    limitations: z.array(z.string()),
  })
  .strict()
  .superRefine((metric, ctx) => {
    if (
      ["higher_is_better", "lower_is_better"].includes(metric.direction) &&
      (typeof metric.threshold !== "number" || !metric.unit?.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Numeric qualification metrics require a numeric threshold and unit.",
      });
    }
    if (
      metric.direction === "inside_range" &&
      (metric.lowerBound === undefined ||
        metric.upperBound === undefined ||
        !metric.unit?.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Range qualification metrics require lowerBound, upperBound, and unit.",
      });
    }
    if (
      metric.direction === "boolean" &&
      typeof metric.threshold !== "boolean"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Boolean qualification metrics require a boolean threshold.",
      });
    }
    if (
      metric.direction === "categorical" &&
      (typeof metric.threshold !== "string" || !metric.threshold.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Categorical qualification metrics require a string threshold.",
      });
    }
    if (
      metric.aggregation === "percentile" &&
      (metric.aggregationParameter === undefined ||
        metric.aggregationParameter <= 0 ||
        metric.aggregationParameter > 100)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percentile aggregation requires a parameter in (0, 100].",
      });
    }
  });

const ComparatorSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum([
      "no_system",
      "current_manual_process",
      "incumbent_system",
      "vendor_offering",
      "customer_requirement",
      "prior_garpa_build",
    ]),
    name: z.string().min(1),
    version: z.string().optional(),
    scenarioIds: z.array(z.string()),
    metricIds: z.array(z.string()),
    resultEvidenceCellIds: z.array(z.string()),
    comparability: z.enum([
      "same_fixture",
      "normalized",
      "reported_only",
      "not_comparable",
    ]),
    limitations: z.array(z.string()),
  })
  .strict();

const AuthorizationSchema = z
  .object({
    id: z.string().min(1),
    venueClass: VenueClass,
    ownerOrController: z.string().min(1),
    permittedActivities: z.array(z.string()),
    prohibitedActivities: z.array(z.string()),
    requiredAuthorizations: z.array(z.string()),
    receivedAuthorizationRefs: z.array(z.string()),
    abortAuthority: z.array(z.string()),
    geographicBoundary: z.string().optional(),
    timeBoundary: z.string().optional(),
    evidenceCellIds: z.array(z.string()),
    state: z.enum(["admitted", "not_required", "blocked", "unresolved"]),
    rationale: z.string().min(1),
  })
  .strict();

const QualificationContractSchema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    missionOutcomeDigest: z.string().min(1),
    capabilityGraphDigest: z.string().min(1),
    candidateArchitectureDigest: z.string().min(1),
    scenarios: z.array(ScenarioSchema).min(1),
    metrics: z.array(MetricSchema).min(1),
    instrumentation: z.array(InstrumentationSchema).min(1),
    comparators: z.array(ComparatorSchema).min(1),
    accountingBoundary: z
      .object({
        currency: z.string().min(1),
        evaluationPeriod: z.string().min(1),
        includedCategories: z.array(z.string()).min(1),
        excludedCategories: z.array(z.string()),
        missionDenominator: z.string().min(1),
      })
      .strict(),
    authorizations: z.array(AuthorizationSchema),
    acceptanceRule: z
      .object({
        allEssentialMustPass: z.boolean(),
        allowInconclusiveEssential: z.boolean(),
        minimumValidRunsPerMetric: z.number().int().positive(),
        missingDataDisposition: z.enum(["fail", "inconclusive"]),
        invalidRunDisposition: z.enum(["exclude_with_receipt", "fail"]),
        secondaryMetricsCanOffsetEssentialFailure: z.boolean(),
      })
      .strict(),
    frozenAt: z.string().min(1),
    supersedesDigest: z.string().optional(),
    state: z.enum(["candidate", "frozen", "superseded"]),
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
  const ids = items.map((item) => item.id);
  return Array.from(new Set(ids.filter((id, index) => ids.indexOf(id) !== index)));
}

function checkRefs(
  ids: string[],
  validIds: ReadonlySet<string>,
  path: string,
  kind: string,
  errors: string[],
): void {
  for (const id of ids) {
    if (!validIds.has(id)) errors.push(`${path} references unknown ${kind} "${id}".`);
  }
}

export function validateQualificationContract(
  input: unknown,
  outcome: MissionOutcome,
  architecture: CandidateArchitecture,
  packet: ClaimPacket,
): GarpaValidationResult<QualificationContract> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };

  const parsed = QualificationContractSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const contract = parsed.data as QualificationContract;
  const errors: string[] = [];
  for (const [label, items] of [
    ["scenarios", contract.scenarios],
    ["metrics", contract.metrics],
    ["instrumentation", contract.instrumentation],
    ["comparators", contract.comparators],
    ["authorizations", contract.authorizations],
  ] as const) {
    for (const id of duplicateIds(items)) errors.push(`${label} contains duplicate id "${id}".`);
  }

  const scenarioIds = new Set(contract.scenarios.map((scenario) => scenario.id));
  const metricIds = new Set(contract.metrics.map((metric) => metric.id));
  const instrumentIds = new Set(
    contract.instrumentation.map((instrument) => instrument.id),
  );
  const authorizationIds = new Set(
    contract.authorizations.map((authorization) => authorization.id),
  );
  const missionMetricIds = new Set(
    outcome.successMetrics.map((metric) => metric.id),
  );
  const riskIds = new Set(architecture.risks.map((risk) => risk.id));
  const residualIds = new Set(
    architecture.residuals.map((residual) => residual.id),
  );
  const evidenceIds = new Set(packet.evidence.map((cell) => cell.id));

  contract.instrumentation.forEach((instrument, index) => {
    checkRefs(
      instrument.calibrationEvidenceIds,
      evidenceIds,
      `instrumentation.${index}`,
      "evidence",
      errors,
    );
  });

  contract.scenarios.forEach((scenario, index) => {
    checkRefs(scenario.metricIds, metricIds, `scenarios.${index}`, "metric", errors);
    checkRefs(
      scenario.instrumentationIds,
      instrumentIds,
      `scenarios.${index}`,
      "instrumentation",
      errors,
    );
    if (scenario.authorizationId) {
      checkRefs(
        [scenario.authorizationId],
        authorizationIds,
        `scenarios.${index}`,
        "authorization",
        errors,
      );
    }
    checkRefs(
      scenario.evidenceCellIds,
      evidenceIds,
      `scenarios.${index}`,
      "evidence",
      errors,
    );
  });

  contract.metrics.forEach((metric, index) => {
    checkRefs(
      metric.missionMetricIds,
      missionMetricIds,
      `metrics.${index}`,
      "mission metric",
      errors,
    );
    checkRefs(metric.riskIds, riskIds, `metrics.${index}`, "risk", errors);
    checkRefs(
      metric.residualIds,
      residualIds,
      `metrics.${index}`,
      "residual",
      errors,
    );
    checkRefs(
      metric.instrumentationIds,
      instrumentIds,
      `metrics.${index}`,
      "instrumentation",
      errors,
    );
    checkRefs(
      metric.evidenceCellIds,
      evidenceIds,
      `metrics.${index}`,
      "evidence",
      errors,
    );
  });

  contract.comparators.forEach((comparator, index) => {
    checkRefs(
      comparator.scenarioIds,
      scenarioIds,
      `comparators.${index}`,
      "scenario",
      errors,
    );
    checkRefs(
      comparator.metricIds,
      metricIds,
      `comparators.${index}`,
      "metric",
      errors,
    );
    checkRefs(
      comparator.resultEvidenceCellIds,
      evidenceIds,
      `comparators.${index}`,
      "evidence",
      errors,
    );
  });

  contract.authorizations.forEach((authorization, index) => {
    checkRefs(
      authorization.evidenceCellIds,
      evidenceIds,
      `authorizations.${index}`,
      "evidence",
      errors,
    );
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: contract };
}
