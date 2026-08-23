import { z } from "zod";
import type {
  BuildReceipt,
  ExecutionValidationResult,
  TestRunReceipt,
} from "../../types/garpaExecution";

const ArtifactSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum([
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
    ]),
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

const InstalledHardwareSchema = z
  .object({
    id: z.string().min(1),
    manifestItemId: z.string().min(1),
    manufacturer: z.string().optional(),
    model: z.string().min(1),
    revision: z.string().optional(),
    serialOrLot: z.string().optional(),
    firmwareVersion: z.string().optional(),
    quantity: z.number().int().positive(),
    functionIds: z.array(z.string()).default([]),
  })
  .strict();

const InstalledSoftwareSchema = z
  .object({
    id: z.string().min(1),
    manifestItemId: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    packageOrImageDigest: z.string().min(1),
    configurationDigest: z.string().min(1),
    functionIds: z.array(z.string()).default([]),
  })
  .strict();

const CodeCommitSchema = z
  .object({
    repository: z.string().min(1),
    commit: z.string().min(1),
    dirty: z.boolean(),
    purpose: z.string().min(1),
  })
  .strict();

const DeviationSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().min(1),
    severity: z.enum(["minor", "material", "unsafe"]),
    affectedFunctionIds: z.array(z.string()).default([]),
    affectedMetricIds: z.array(z.string()).default([]),
    closureState: z.enum(["open", "accepted", "requalified", "closed"]),
    evidenceArtifactIds: z.array(z.string()).default([]),
  })
  .strict();

const SubstitutionSchema = z
  .object({
    id: z.string().min(1),
    originalManifestItemId: z.string().min(1),
    replacementInstalledItemId: z.string().min(1),
    policyRef: z.string().optional(),
    requiredRegressionTestIds: z.array(z.string()).default([]),
    rationale: z.string().min(1),
  })
  .strict();

const ActualCostSchema = z
  .object({
    id: z.string().min(1),
    category: z.enum([
      "hardware",
      "software",
      "services",
      "fabrication",
      "integration_labor",
      "operator_labor",
      "test_equipment",
      "qualification",
      "maintenance",
      "spares",
      "communications",
      "facilities",
      "energy",
      "regulatory",
      "other",
    ]),
    description: z.string().min(1),
    amount: z.number().nonnegative(),
    currency: z.string().min(1),
    incurredAt: z.string().min(1),
    evidenceArtifactIds: z.array(z.string()).default([]),
  })
  .strict();

const LaborSchema = z
  .object({
    id: z.string().min(1),
    actor: z.string().min(1),
    category: z.enum([
      "research",
      "procurement",
      "assembly",
      "configuration",
      "custom_development",
      "integration",
      "debugging",
      "test_preparation",
      "test_execution",
      "analysis",
      "documentation",
    ]),
    hours: z.number().positive(),
    startedAt: z.string().optional(),
    endedAt: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();

const BuildReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    buildId: z.string().min(1),
    manifestDigest: z.string().min(1),
    architectureDigest: z.string().min(1),
    qualificationContractDigest: z.string().min(1),
    startedAt: z.string().min(1),
    completedAt: z.string().optional(),
    installedHardware: z.array(InstalledHardwareSchema),
    installedSoftware: z.array(InstalledSoftwareSchema),
    codeCommits: z.array(CodeCommitSchema),
    substitutions: z.array(SubstitutionSchema),
    deviations: z.array(DeviationSchema),
    actualCostLines: z.array(ActualCostSchema),
    actualLabor: z.array(LaborSchema),
    artifacts: z.array(ArtifactSchema),
    buildDigest: z.string().min(1),
    state: z.enum(["in_progress", "assembled", "blocked", "superseded"]),
  })
  .strict()
  .superRefine((receipt, ctx) => {
    if (receipt.state === "assembled" && !receipt.completedAt?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["completedAt"],
        message: "assembled builds require completedAt.",
      });
    }
    if (receipt.completedAt && Date.parse(receipt.completedAt) < Date.parse(receipt.startedAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["completedAt"],
        message: "completedAt cannot precede startedAt.",
      });
    }
  });

const MetricResultSchema = z
  .object({
    metricId: z.string().min(1),
    rawSampleArtifactIds: z.array(z.string()).default([]),
    calculationMethod: z.string().min(1),
    codeDigest: z.string().optional(),
    sampleCount: z.number().int().nonnegative(),
    excludedSamples: z.array(
      z
        .object({
          sampleRef: z.string().min(1),
          reason: z.string().min(1),
        })
        .strict(),
    ),
    value: z.union([z.number(), z.string(), z.boolean()]).optional(),
    uncertainty: z.string().optional(),
    thresholdResult: z.enum(["pass", "fail", "inconclusive", "not_measured"]),
    analystNotes: z.array(z.string()).default([]),
  })
  .strict()
  .superRefine((metric, ctx) => {
    if (metric.excludedSamples.length > metric.sampleCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["excludedSamples"],
        message: "excluded sample count cannot exceed sampleCount.",
      });
    }
    if (
      (metric.thresholdResult === "pass" || metric.thresholdResult === "fail") &&
      metric.value === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "pass or fail results require a measured value.",
      });
    }
    if (
      metric.thresholdResult !== "not_measured" &&
      metric.rawSampleArtifactIds.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rawSampleArtifactIds"],
        message: "measured results require raw sample artifacts.",
      });
    }
  });

const InterventionSchema = z
  .object({
    id: z.string().min(1),
    occurredAt: z.string().min(1),
    actor: z.string().min(1),
    description: z.string().min(1),
    affectedMetricIds: z.array(z.string()).default([]),
    authorized: z.boolean(),
  })
  .strict();

const AnomalySchema = z
  .object({
    id: z.string().min(1),
    occurredAt: z.string().min(1),
    description: z.string().min(1),
    affectedMetricIds: z.array(z.string()).default([]),
    disposition: z.enum(["open", "accepted", "invalidates_run", "closed"]),
  })
  .strict();

const AbortSchema = z
  .object({
    id: z.string().min(1),
    occurredAt: z.string().min(1),
    authority: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

const TestRunReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    runId: z.string().min(1),
    buildDigest: z.string().min(1),
    qualificationContractDigest: z.string().min(1),
    scenarioId: z.string().min(1),
    testId: z.string().min(1),
    startedAt: z.string().min(1),
    endedAt: z.string().min(1),
    operators: z.array(z.string().min(1)).min(1),
    observers: z.array(z.string().min(1)),
    configurationDigest: z.string().min(1),
    fixtureState: z.record(z.string()),
    environmentObserved: z.record(z.string()),
    rawDataArtifactIds: z.array(z.string()).default([]),
    logArtifactIds: z.array(z.string()).default([]),
    observationArtifactIds: z.array(z.string()).default([]),
    metricResults: z.array(MetricResultSchema),
    interventions: z.array(InterventionSchema),
    anomalies: z.array(AnomalySchema),
    aborts: z.array(AbortSchema),
    resultDigest: z.string().min(1),
    state: z.enum(["valid", "invalidated", "aborted", "incomplete"]),
  })
  .strict()
  .superRefine((receipt, ctx) => {
    if (Date.parse(receipt.endedAt) < Date.parse(receipt.startedAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endedAt"],
        message: "endedAt cannot precede startedAt.",
      });
    }
    if (receipt.state === "valid" && receipt.metricResults.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["metricResults"],
        message: "valid runs require at least one metric result.",
      });
    }
    if (receipt.state === "aborted" && receipt.aborts.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["aborts"],
        message: "aborted runs require an abort receipt.",
      });
    }
  });

function parseInput(input: unknown): ExecutionValidationResult<unknown> {
  if (typeof input !== "string") return { ok: true, errors: [], value: input };
  try {
    return { ok: true, errors: [], value: JSON.parse(input) as unknown };
  } catch (error) {
    return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
  }
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
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

export function validateBuildReceipt(
  input: unknown,
): ExecutionValidationResult<BuildReceipt> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  const parsed = BuildReceiptSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const receipt = parsed.data as BuildReceipt;
  const errors: string[] = [];
  const groups: Array<[string, { id: string }[]]> = [
    ["installedHardware", receipt.installedHardware],
    ["installedSoftware", receipt.installedSoftware],
    ["substitutions", receipt.substitutions],
    ["deviations", receipt.deviations],
    ["actualCostLines", receipt.actualCostLines],
    ["actualLabor", receipt.actualLabor],
    ["artifacts", receipt.artifacts],
  ];
  for (const [label, items] of groups) {
    for (const id of duplicateIds(items)) errors.push(`${label} contains duplicate id "${id}".`);
  }

  const installedIds = new Set([
    ...receipt.installedHardware.map((item) => item.id),
    ...receipt.installedSoftware.map((item) => item.id),
  ]);
  receipt.substitutions.forEach((substitution, index) => {
    if (!installedIds.has(substitution.replacementInstalledItemId)) {
      errors.push(
        `substitutions.${index} references unknown installed item "${substitution.replacementInstalledItemId}".`,
      );
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: receipt };
}

export function validateTestRunReceipt(
  input: unknown,
): ExecutionValidationResult<TestRunReceipt> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  const parsed = TestRunReceiptSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const receipt = parsed.data as TestRunReceipt;
  const errors: string[] = [];
  const metricIds = new Set<string>();
  for (const metric of receipt.metricResults) {
    if (metricIds.has(metric.metricId)) {
      errors.push(`metricResults contains duplicate metricId "${metric.metricId}".`);
    }
    metricIds.add(metric.metricId);
    for (const artifactId of metric.rawSampleArtifactIds) {
      if (!receipt.rawDataArtifactIds.includes(artifactId)) {
        errors.push(
          `metric ${metric.metricId} references raw artifact "${artifactId}" absent from rawDataArtifactIds.`,
        );
      }
    }
  }

  const duplicateGroups: Array<[string, { id: string }[]]> = [
    ["interventions", receipt.interventions],
    ["anomalies", receipt.anomalies],
    ["aborts", receipt.aborts],
  ];
  for (const [label, items] of duplicateGroups) {
    for (const id of duplicateIds(items)) errors.push(`${label} contains duplicate id "${id}".`);
  }

  if (receipt.state === "valid") {
    const invalidatingAnomaly = receipt.anomalies.some(
      (anomaly) => anomaly.disposition === "invalidates_run",
    );
    if (invalidatingAnomaly) {
      errors.push("valid runs cannot contain an anomaly with disposition invalidates_run.");
    }
    if (receipt.aborts.length > 0) {
      errors.push("valid runs cannot contain abort receipts.");
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: receipt };
}
