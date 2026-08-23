import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type { CandidateArchitecture } from "../../types/garpaArchitecture";
import type { BuildManifest } from "../../types/garpaBuild";
import type { QualificationContract } from "../../types/garpaQualification";
import type { SubstitutionPlan } from "../../types/garpaSubstitution";

const ComponentSchema = z
  .object({
    componentId: z.string().min(1),
    kind: z.enum([
      "hardware",
      "software",
      "service",
      "fabricated_item",
      "test_equipment",
      "other",
    ]),
    exactModelOrVersion: z.string().min(1),
    quantity: z.number().positive(),
    supplierOrSource: z.string().min(1),
    acquisitionState: z.enum(["existing", "to_acquire", "reserved"]),
    unitCost: z.number().nonnegative(),
    currency: z.string().min(1),
    configurationDigest: z.string().min(1),
    firmwareOrRuntimeVersion: z.string().optional(),
    license: z.string().optional(),
    serialOrLotPolicy: z.enum(["record_each", "not_applicable"]),
    functionIds: z.array(z.string()),
    interfaceIds: z.array(z.string()),
    calibrationRequired: z.boolean(),
  })
  .strict();

const CustomCodeSchema = z
  .object({
    customCodeId: z.string().min(1),
    exactVersion: z.string().min(1),
    sourceCommit: z.string().min(1),
    packageDigest: z.string().min(1),
    dependencyLockDigest: z.string().min(1),
    configurationDigest: z.string().min(1),
    buildAndInstallProcedure: z.array(z.string()).min(1),
    functionIds: z.array(z.string()),
    interfaceIds: z.array(z.string()),
  })
  .strict();

const CompatibilitySchema = z
  .object({
    compatibilityEdgeId: z.string().min(1),
    interfaceId: z.string().min(1),
    producerComponentIds: z.array(z.string()),
    consumerComponentIds: z.array(z.string()),
    adapterComponentIds: z.array(z.string()),
    customCodeIds: z.array(z.string()),
    acceptanceTestIds: z.array(z.string()).min(1),
  })
  .strict();

const RoleSchema = z
  .object({
    humanRoleId: z.string().min(1),
    staffing: z.string().min(1),
    requiredTraining: z.array(z.string()),
    responsibilities: z.array(z.string()).min(1),
    authorityBoundary: z.string().optional(),
  })
  .strict();

const DependencySchema = z
  .object({
    dependencyId: z.string().min(1),
    providerOrSource: z.string().min(1),
    exactServiceOrDatasetVersion: z.string().min(1),
    availabilityCheck: z.string().min(1),
    fallback: z.string().optional(),
  })
  .strict();

const InstrumentSchema = z
  .object({
    instrumentationId: z.string().min(1),
    exactModelOrVersion: z.string().min(1),
    configurationDigest: z.string().min(1),
    calibrationState: z.enum(["current", "not_required"]),
    calibrationEvidenceIds: z.array(z.string()),
    storagePath: z.string().min(1),
  })
  .strict();

const CalibrationSchema = z
  .object({
    id: z.string().min(1),
    subjectId: z.string().min(1),
    method: z.string().min(1),
    acceptanceCondition: z.string().min(1),
    evidenceArtifactPattern: z.string().min(1),
    owner: z.string().min(1),
  })
  .strict();

const SubstitutionPolicySchema = z
  .object({
    componentId: z.string().min(1),
    policy: z.enum([
      "no_substitution",
      "equivalent_with_retest",
      "architecture_review",
    ]),
    equivalenceCriteria: z.array(z.string()),
    requiredRegressionTestIds: z.array(z.string()),
    prohibitedSubstitutions: z.array(z.string()),
  })
  .strict();

const AssemblyStepSchema = z
  .object({
    id: z.string().min(1),
    predecessorIds: z.array(z.string()),
    componentIds: z.array(z.string()),
    customCodeIds: z.array(z.string()),
    compatibilityEdgeIds: z.array(z.string()),
    procedure: z.array(z.string()).min(1),
    acceptanceCondition: z.string().min(1),
    rollbackProcedure: z.array(z.string()).min(1),
    owner: z.string().min(1),
  })
  .strict();

const BuildManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    candidateArchitectureDigest: z.string().min(1),
    qualificationContractDigest: z.string().min(1),
    components: z.array(ComponentSchema),
    customCode: z.array(CustomCodeSchema),
    compatibilityEdges: z.array(CompatibilitySchema),
    humanRoles: z.array(RoleSchema),
    dependencies: z.array(DependencySchema),
    instrumentation: z.array(InstrumentSchema),
    calibrationPlan: z.array(CalibrationSchema),
    substitutionPolicies: z.array(SubstitutionPolicySchema),
    assemblySteps: z.array(AssemblyStepSchema).min(1),
    expectedCostLineIds: z.array(z.string()),
    expectedScheduleLineIds: z.array(z.string()),
    manifestDigest: z.string().min(1),
    frozenAt: z.string().min(1),
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

function duplicateStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.filter((value, index) => values.indexOf(value) !== index)),
  );
}

function checkRefs(
  ids: string[],
  validIds: ReadonlySet<string>,
  path: string,
  kind: string,
  errors: string[],
): void {
  for (const id of ids) {
    if (!validIds.has(id)) {
      errors.push(`${path} references unknown ${kind} "${id}".`);
    }
  }
}

export function validateBuildManifest(
  input: unknown,
  architecture: CandidateArchitecture,
  plan: SubstitutionPlan,
  qualification: QualificationContract,
): GarpaValidationResult<BuildManifest> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };

  const parsed = BuildManifestSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const manifest = parsed.data as BuildManifest;
  const errors: string[] = [];
  for (const [label, values] of [
    ["components", manifest.components.map((item) => item.componentId)],
    ["customCode", manifest.customCode.map((item) => item.customCodeId)],
    [
      "compatibilityEdges",
      manifest.compatibilityEdges.map((item) => item.compatibilityEdgeId),
    ],
    ["humanRoles", manifest.humanRoles.map((item) => item.humanRoleId)],
    ["dependencies", manifest.dependencies.map((item) => item.dependencyId)],
    [
      "instrumentation",
      manifest.instrumentation.map((item) => item.instrumentationId),
    ],
    ["calibrationPlan", manifest.calibrationPlan.map((item) => item.id)],
    [
      "substitutionPolicies",
      manifest.substitutionPolicies.map((item) => item.componentId),
    ],
    ["assemblySteps", manifest.assemblySteps.map((item) => item.id)],
  ] as const) {
    for (const duplicate of duplicateStrings(values)) {
      errors.push(`${label} contains duplicate id "${duplicate}".`);
    }
  }

  const componentIds = new Set(plan.components.map((item) => item.id));
  const customCodeIds = new Set(plan.customCode.map((item) => item.id));
  const compatibilityIds = new Set(
    plan.compatibilityEdges.map((item) => item.id),
  );
  const architectureRoleIds = new Set(
    architecture.humanRoleSelections.map((item) => item.humanRoleId),
  );
  const architectureDependencyIds = new Set(
    architecture.dependencySelections.map((item) => item.dependencyId),
  );
  const qualificationInstrumentIds = new Set(
    qualification.instrumentation.map((item) => item.id),
  );
  const qualificationMetricIds = new Set(
    qualification.metrics.map((item) => item.id),
  );
  const functionIds = new Set(
    architecture.componentSelections.flatMap((item) => item.functionIds),
  );
  const interfaceIds = new Set(
    architecture.componentSelections.flatMap((item) => item.interfaceIds),
  );
  const costLineIds = new Set(
    architecture.costEnvelope.lines.map((item) => item.id),
  );
  const scheduleLineIds = new Set(
    architecture.scheduleEnvelope.lines.map((item) => item.id),
  );

  manifest.components.forEach((item, index) => {
    checkRefs(
      [item.componentId],
      componentIds,
      `components.${index}`,
      "component",
      errors,
    );
    checkRefs(
      item.functionIds,
      functionIds,
      `components.${index}`,
      "function",
      errors,
    );
    checkRefs(
      item.interfaceIds,
      interfaceIds,
      `components.${index}`,
      "interface",
      errors,
    );
  });
  manifest.customCode.forEach((item, index) => {
    checkRefs(
      [item.customCodeId],
      customCodeIds,
      `customCode.${index}`,
      "custom code",
      errors,
    );
    checkRefs(
      item.functionIds,
      functionIds,
      `customCode.${index}`,
      "function",
      errors,
    );
    checkRefs(
      item.interfaceIds,
      interfaceIds,
      `customCode.${index}`,
      "interface",
      errors,
    );
  });
  manifest.compatibilityEdges.forEach((item, index) => {
    checkRefs(
      [item.compatibilityEdgeId],
      compatibilityIds,
      `compatibilityEdges.${index}`,
      "compatibility edge",
      errors,
    );
    checkRefs(
      item.producerComponentIds,
      componentIds,
      `compatibilityEdges.${index}`,
      "component",
      errors,
    );
    checkRefs(
      item.consumerComponentIds,
      componentIds,
      `compatibilityEdges.${index}`,
      "component",
      errors,
    );
    checkRefs(
      item.adapterComponentIds,
      componentIds,
      `compatibilityEdges.${index}`,
      "component",
      errors,
    );
    checkRefs(
      item.customCodeIds,
      customCodeIds,
      `compatibilityEdges.${index}`,
      "custom code",
      errors,
    );
    checkRefs(
      item.acceptanceTestIds,
      qualificationMetricIds,
      `compatibilityEdges.${index}`,
      "qualification metric",
      errors,
    );
  });
  manifest.humanRoles.forEach((item, index) => {
    checkRefs(
      [item.humanRoleId],
      architectureRoleIds,
      `humanRoles.${index}`,
      "human role",
      errors,
    );
  });
  manifest.dependencies.forEach((item, index) => {
    checkRefs(
      [item.dependencyId],
      architectureDependencyIds,
      `dependencies.${index}`,
      "dependency",
      errors,
    );
  });
  manifest.instrumentation.forEach((item, index) => {
    checkRefs(
      [item.instrumentationId],
      qualificationInstrumentIds,
      `instrumentation.${index}`,
      "instrumentation",
      errors,
    );
  });

  const manifestSubjectIds = new Set([
    ...manifest.components.map((item) => item.componentId),
    ...manifest.instrumentation.map((item) => item.instrumentationId),
  ]);
  manifest.calibrationPlan.forEach((item, index) => {
    checkRefs(
      [item.subjectId],
      manifestSubjectIds,
      `calibrationPlan.${index}`,
      "calibration subject",
      errors,
    );
  });
  manifest.substitutionPolicies.forEach((item, index) => {
    checkRefs(
      [item.componentId],
      componentIds,
      `substitutionPolicies.${index}`,
      "component",
      errors,
    );
    checkRefs(
      item.requiredRegressionTestIds,
      qualificationMetricIds,
      `substitutionPolicies.${index}`,
      "qualification metric",
      errors,
    );
  });

  const assemblyIds = new Set(manifest.assemblySteps.map((item) => item.id));
  manifest.assemblySteps.forEach((item, index) => {
    checkRefs(
      item.predecessorIds,
      assemblyIds,
      `assemblySteps.${index}`,
      "assembly predecessor",
      errors,
    );
    checkRefs(
      item.componentIds,
      componentIds,
      `assemblySteps.${index}`,
      "component",
      errors,
    );
    checkRefs(
      item.customCodeIds,
      customCodeIds,
      `assemblySteps.${index}`,
      "custom code",
      errors,
    );
    checkRefs(
      item.compatibilityEdgeIds,
      compatibilityIds,
      `assemblySteps.${index}`,
      "compatibility edge",
      errors,
    );
  });

  checkRefs(
    manifest.expectedCostLineIds,
    costLineIds,
    "expectedCostLineIds",
    "architecture cost line",
    errors,
  );
  checkRefs(
    manifest.expectedScheduleLineIds,
    scheduleLineIds,
    "expectedScheduleLineIds",
    "architecture schedule line",
    errors,
  );

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: manifest };
}
