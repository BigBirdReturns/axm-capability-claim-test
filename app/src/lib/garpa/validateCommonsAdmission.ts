import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type { CommonsAdmissionRequest } from "../../types/garpaCommons";

const SHA256 = /^[a-f0-9]{64}$/i;

const executionClass = z.enum([
  "E0_analysis_only",
  "E1_simulation_or_replay",
  "E2_bench_passive",
  "E3_controlled_field_inert",
  "E4_regulated_active",
  "E5_operational_environment",
]);

const thresholdResult = z.enum([
  "pass",
  "fail",
  "inconclusive",
  "not_measured",
]);

const MetricResultSchema = z
  .object({
    metricId: z.string().min(1),
    rawSampleArtifactIds: z.array(z.string().min(1)),
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
    thresholdResult,
    analystNotes: z.array(z.string()),
  })
  .strict();

const InterfacePatternSchema = z
  .object({
    name: z.string().min(1),
    interfaceType: z.enum([
      "data",
      "power",
      "mechanical",
      "network",
      "human",
      "environmental",
      "organizational",
    ]),
    direction: z.enum(["input", "output", "bidirectional"]),
    protocolOrFormat: z.string().optional(),
    constraints: z.array(z.string()),
  })
  .strict();

const ImplementationRefSchema = z
  .object({
    caseId: z.string().min(1),
    releaseId: z.string().min(1),
    buildReceiptDigest: z.string().optional(),
    componentIds: z.array(z.string().min(1)),
    architecturePatternIds: z.array(z.string().min(1)),
    note: z.string().min(1),
  })
  .strict();

const QualificationRefSchema = z
  .object({
    caseId: z.string().min(1),
    releaseId: z.string().min(1),
    qualificationContractDigest: z.string().min(1),
    runReceiptIds: z.array(z.string().min(1)),
    scenarioIds: z.array(z.string().min(1)),
    metricIds: z.array(z.string().min(1)),
    executionClass,
    state: z.enum([
      "candidate",
      "bench_observed",
      "field_observed",
      "repeated",
    ]),
    limitations: z.array(z.string()),
  })
  .strict();

const PrimitiveSchema = z
  .object({
    primitiveId: z.string().min(1),
    name: z.string().min(1),
    purpose: z.string().min(1),
    functionClass: z.enum([
      "essential",
      "enabling",
      "coordination",
      "sustainment",
      "assurance",
    ]),
    inputInterfacePatterns: z.array(InterfacePatternSchema),
    outputInterfacePatterns: z.array(InterfacePatternSchema),
    operatingConstraints: z.array(z.string()),
    humanRoles: z.array(z.string()),
    observedImplementations: z.array(ImplementationRefSchema),
    qualificationRefs: z.array(QualificationRefSchema),
    maturity: z.enum([
      "concept",
      "candidate",
      "bench_observed",
      "field_observed",
      "repeated",
    ]),
    residuals: z.array(z.string()),
    falsificationConditions: z.array(z.string()),
    sourceCaseIds: z.array(z.string().min(1)).min(1),
    sourceReleaseIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

const ComponentIdentitySchema = z
  .object({
    manufacturer: z.string().optional(),
    product: z.string().min(1),
    exactModelOrVersion: z.string().min(1),
    firmwareOrSoftwareVersion: z.string().optional(),
  })
  .strict();

const CostObservationSchema = z
  .object({
    amount: z.number().nonnegative(),
    currency: z.string().min(1),
    capturedAt: z.string().min(1),
    accountingBoundary: z.string().min(1),
    evidenceArtifactIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

const ComponentObservationSchema = z
  .object({
    observationId: z.string().min(1),
    componentIdentity: ComponentIdentitySchema,
    functionIds: z.array(z.string().min(1)),
    interfaceIds: z.array(z.string().min(1)),
    fixture: z.string().min(1),
    environment: z.record(z.string()),
    executionClass: executionClass.optional(),
    metricResults: z.array(MetricResultSchema),
    runReceiptIds: z.array(z.string().min(1)),
    costObservation: CostObservationSchema.optional(),
    state: z.enum([
      "vendor_claimed",
      "externally_reported",
      "locally_observed",
      "locally_qualified",
    ]),
    limitations: z.array(z.string()),
    residuals: z.array(z.string()),
    sourceCaseId: z.string().min(1),
    sourceReleaseId: z.string().min(1),
    sourceReleaseDigest: z.string().regex(SHA256),
  })
  .strict();

const ArchitecturePatternSchema = z
  .object({
    patternId: z.string().min(1),
    name: z.string().min(1),
    problemShape: z.string().min(1),
    functionRoles: z.array(z.string()),
    interfaceRoles: z.array(z.string()),
    knownImplementationRefs: z.array(ImplementationRefSchema),
    qualificationRefs: z.array(QualificationRefSchema),
    applicableConstraints: z.array(z.string()),
    failureModes: z.array(z.string()),
    residuals: z.array(z.string()),
    sourceCaseIds: z.array(z.string().min(1)).min(1),
    sourceReleaseIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

const RequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceCaseId: z.string().min(1),
    sourceReleaseId: z.string().min(1),
    sourceReleaseDigest: z.string().regex(SHA256),
    releaseVerificationState: z.enum([
      "current_valid",
      "superseded_valid",
      "withdrawn_valid",
    ]),
    primitives: z.array(PrimitiveSchema),
    componentObservations: z.array(ComponentObservationSchema),
    architecturePatterns: z.array(ArchitecturePatternSchema),
  })
  .strict()
  .superRefine((request, ctx) => {
    if (
      request.primitives.length === 0 &&
      request.componentObservations.length === 0 &&
      request.architecturePatterns.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A commons admission request must contain at least one object.",
      });
    }
  });

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

function declaredReferenceErrors(
  label: string,
  sourceCaseIds: string[],
  sourceReleaseIds: string[],
  implementations: Array<{ caseId: string; releaseId: string; architecturePatternIds: string[] }>,
  qualifications: Array<{ caseId: string; releaseId: string }>,
  knownPatternIds: Set<string>,
): string[] {
  const errors: string[] = [];
  for (const ref of [...implementations, ...qualifications]) {
    if (!sourceCaseIds.includes(ref.caseId)) {
      errors.push(`${label} reference case "${ref.caseId}" is absent from sourceCaseIds.`);
    }
    if (!sourceReleaseIds.includes(ref.releaseId)) {
      errors.push(`${label} reference release "${ref.releaseId}" is absent from sourceReleaseIds.`);
    }
  }
  for (const ref of implementations) {
    for (const patternId of ref.architecturePatternIds) {
      if (!knownPatternIds.has(patternId)) {
        errors.push(`${label} references unknown architecture pattern "${patternId}".`);
      }
    }
  }
  return errors;
}

export function validateCommonsAdmissionRequest(
  input: unknown,
): GarpaValidationResult<CommonsAdmissionRequest> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  const parsed = RequestSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const request = parsed.data as CommonsAdmissionRequest;
  const errors: string[] = [];
  for (const [label, values] of [
    ["primitiveIds", request.primitives.map((item) => item.primitiveId)],
    ["componentObservationIds", request.componentObservations.map((item) => item.observationId)],
    ["architecturePatternIds", request.architecturePatterns.map((item) => item.patternId)],
  ] as const) {
    for (const value of duplicates([...values])) {
      errors.push(`${label} contains duplicate value "${value}".`);
    }
  }

  const patternIds = new Set(request.architecturePatterns.map((item) => item.patternId));
  for (const primitive of request.primitives) {
    errors.push(
      ...declaredReferenceErrors(
        `primitive ${primitive.primitiveId}`,
        primitive.sourceCaseIds,
        primitive.sourceReleaseIds,
        primitive.observedImplementations,
        primitive.qualificationRefs,
        patternIds,
      ),
    );
  }
  for (const pattern of request.architecturePatterns) {
    errors.push(
      ...declaredReferenceErrors(
        `architecture pattern ${pattern.patternId}`,
        pattern.sourceCaseIds,
        pattern.sourceReleaseIds,
        pattern.knownImplementationRefs,
        pattern.qualificationRefs,
        patternIds,
      ),
    );
  }

  if (errors.length > 0) return { ok: false, errors: Array.from(new Set(errors)) };
  return { ok: true, errors: [], value: request };
}
