import { z } from "zod";
import type { ClaimPacket, GarpaValidationResult } from "../../types/garpa";
import type { CapabilityGraph } from "../../types/garpaCapability";
import type { CandidateArchitecture } from "../../types/garpaArchitecture";
import type { SubstitutionPlan } from "../../types/garpaSubstitution";

const ComponentSelectionSchema = z
  .object({
    componentId: z.string().min(1),
    quantity: z.number().positive(),
    optionIds: z.array(z.string()),
    functionIds: z.array(z.string()),
    interfaceIds: z.array(z.string()),
    role: z.string().min(1),
    configurationState: z.enum(["defined", "unresolved"]),
    configuration: z.record(z.string()),
  })
  .strict();

const CustomCodeSelectionSchema = z
  .object({
    customCodeId: z.string().min(1),
    optionIds: z.array(z.string()),
    functionIds: z.array(z.string()),
    interfaceIds: z.array(z.string()),
    configurationState: z.enum(["defined", "unresolved"]),
    configuration: z.record(z.string()),
  })
  .strict();

const CompatibilitySelectionSchema = z
  .object({
    compatibilityEdgeId: z.string().min(1),
    interfaceId: z.string().min(1),
    producerComponentIds: z.array(z.string()),
    consumerComponentIds: z.array(z.string()),
    adapterComponentIds: z.array(z.string()),
    customCodeIds: z.array(z.string()),
  })
  .strict();

const HumanRoleSelectionSchema = z
  .object({
    humanRoleId: z.string().min(1),
    staffing: z.string().min(1),
    responsibilities: z.array(z.string()).min(1),
    authorityBoundary: z.string().optional(),
  })
  .strict();

const DependencySelectionSchema = z
  .object({
    dependencyId: z.string().min(1),
    providerOrSource: z.string().min(1),
    availabilityAssumption: z.string().min(1),
    fallback: z.string().optional(),
  })
  .strict();

const CostLineSchema = z
  .object({
    id: z.string().min(1),
    category: z.enum([
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
      "contingency",
    ]),
    description: z.string().min(1),
    low: z.number().nonnegative(),
    expected: z.number().nonnegative(),
    high: z.number().nonnegative(),
    currency: z.string().min(1),
    recurrence: z.enum([
      "one_time",
      "monthly",
      "annual",
      "per_operation",
      "per_unit",
    ]),
    quantity: z.number().positive(),
    basis: z.string().min(1),
    evidenceCellIds: z.array(z.string()),
    confidence: z.enum(["high", "medium", "low", "open"]),
  })
  .strict()
  .superRefine((line, ctx) => {
    if (line.low > line.expected || line.expected > line.high) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cost line requires low <= expected <= high.",
      });
    }
  });

const ScheduleLineSchema = z
  .object({
    id: z.string().min(1),
    phase: z.enum([
      "procurement",
      "assembly",
      "integration",
      "qualification",
      "other",
    ]),
    description: z.string().min(1),
    predecessorIds: z.array(z.string()),
    lowDays: z.number().nonnegative(),
    expectedDays: z.number().nonnegative(),
    highDays: z.number().nonnegative(),
    owner: z.string().min(1),
    acceptanceCondition: z.string().min(1),
  })
  .strict()
  .superRefine((line, ctx) => {
    if (line.lowDays > line.expectedDays || line.expectedDays > line.highDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Schedule line requires lowDays <= expectedDays <= highDays.",
      });
    }
  });

const RiskSchema = z
  .object({
    id: z.string().min(1),
    category: z.enum([
      "performance",
      "integration",
      "availability",
      "security",
      "safety",
      "regulatory",
      "sustainment",
      "cost",
      "schedule",
      "operator_burden",
      "evidence",
    ]),
    statement: z.string().min(1),
    probability: z.enum(["low", "medium", "high", "unknown"]),
    consequence: z.enum([
      "minor",
      "material",
      "mission_failure",
      "unsafe",
      "unknown",
    ]),
    affectedFunctionIds: z.array(z.string()),
    affectedComponentIds: z.array(z.string()),
    mitigation: z.array(z.string()),
    qualificationTestIds: z.array(z.string()),
    evidenceCellIds: z.array(z.string()),
    closureState: z.enum([
      "open",
      "mitigated_by_design",
      "requires_test",
      "accepted",
      "closed",
    ]),
  })
  .strict();

const ResidualSchema = z
  .object({
    id: z.string().min(1),
    statement: z.string().min(1),
    sourceOptionIds: z.array(z.string()),
    sourceComponentIds: z.array(z.string()),
    affectedFunctionIds: z.array(z.string()),
    disposition: z.enum([
      "qualify",
      "accept",
      "redesign",
      "exclude",
      "unresolved",
    ]),
    qualificationTestIds: z.array(z.string()),
  })
  .strict();

const CandidateArchitectureSchema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    missionOutcomeDigest: z.string().min(1),
    capabilityGraphDigest: z.string().min(1),
    substitutionPlanDigest: z.string().min(1),
    selectedOptionIds: z.array(z.string()),
    componentSelections: z.array(ComponentSelectionSchema),
    customCodeSelections: z.array(CustomCodeSelectionSchema),
    compatibilitySelections: z.array(CompatibilitySelectionSchema),
    humanRoleSelections: z.array(HumanRoleSelectionSchema),
    dependencySelections: z.array(DependencySelectionSchema),
    costEnvelope: z
      .object({
        currency: z.string().min(1),
        evaluationPeriod: z.string().min(1),
        lines: z.array(CostLineSchema),
        exclusions: z.array(z.string()),
      })
      .strict(),
    scheduleEnvelope: z
      .object({
        lines: z.array(ScheduleLineSchema),
        assumptions: z.array(z.string()),
      })
      .strict(),
    risks: z.array(RiskSchema),
    residuals: z.array(ResidualSchema),
    assumptions: z.array(z.string()),
    exclusions: z.array(z.string()),
    state: z.enum(["concept", "candidate", "integration_ready", "superseded"]),
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
  return Array.from(new Set(values.filter((value, index) => values.indexOf(value) !== index)));
}

function duplicateIds(items: { id: string }[]): string[] {
  return duplicateStrings(items.map((item) => item.id));
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

export function validateCandidateArchitecture(
  input: unknown,
  graph: CapabilityGraph,
  plan: SubstitutionPlan,
  packet: ClaimPacket,
): GarpaValidationResult<CandidateArchitecture> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };

  const parsed = CandidateArchitectureSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const architecture = parsed.data as CandidateArchitecture;
  const errors: string[] = [];

  for (const duplicate of duplicateStrings(architecture.selectedOptionIds)) {
    errors.push(`selectedOptionIds contains duplicate id "${duplicate}".`);
  }
  for (const [label, values] of [
    ["componentSelections", architecture.componentSelections.map((item) => item.componentId)],
    ["customCodeSelections", architecture.customCodeSelections.map((item) => item.customCodeId)],
    ["compatibilitySelections", architecture.compatibilitySelections.map((item) => item.compatibilityEdgeId)],
    ["humanRoleSelections", architecture.humanRoleSelections.map((item) => item.humanRoleId)],
    ["dependencySelections", architecture.dependencySelections.map((item) => item.dependencyId)],
  ] as const) {
    for (const duplicate of duplicateStrings(values)) {
      errors.push(`${label} contains duplicate id "${duplicate}".`);
    }
  }
  for (const [label, items] of [
    ["costEnvelope.lines", architecture.costEnvelope.lines],
    ["scheduleEnvelope.lines", architecture.scheduleEnvelope.lines],
    ["risks", architecture.risks],
    ["residuals", architecture.residuals],
  ] as const) {
    for (const duplicate of duplicateIds(items)) {
      errors.push(`${label} contains duplicate id "${duplicate}".`);
    }
  }

  const optionIds = new Set(plan.options.map((option) => option.id));
  const componentIds = new Set(plan.components.map((component) => component.id));
  const customCodeIds = new Set(plan.customCode.map((code) => code.id));
  const compatibilityEdgeIds = new Set(
    plan.compatibilityEdges.map((edge) => edge.id),
  );
  const functionIds = new Set(graph.functions.map((fn) => fn.id));
  const interfaceIds = new Set(graph.interfaces.map((edge) => edge.id));
  const humanRoleIds = new Set(graph.humanRoles.map((role) => role.id));
  const dependencyIds = new Set(
    graph.externalDependencies.map((dependency) => dependency.id),
  );
  const evidenceIds = new Set(packet.evidence.map((cell) => cell.id));

  checkRefs(
    architecture.selectedOptionIds,
    optionIds,
    "selectedOptionIds",
    "substitution option",
    errors,
  );

  architecture.componentSelections.forEach((selection, index) => {
    checkRefs([selection.componentId], componentIds, `componentSelections.${index}`, "component", errors);
    checkRefs(selection.optionIds, optionIds, `componentSelections.${index}`, "substitution option", errors);
    checkRefs(selection.functionIds, functionIds, `componentSelections.${index}`, "function", errors);
    checkRefs(selection.interfaceIds, interfaceIds, `componentSelections.${index}`, "interface", errors);
  });

  architecture.customCodeSelections.forEach((selection, index) => {
    checkRefs([selection.customCodeId], customCodeIds, `customCodeSelections.${index}`, "custom code", errors);
    checkRefs(selection.optionIds, optionIds, `customCodeSelections.${index}`, "substitution option", errors);
    checkRefs(selection.functionIds, functionIds, `customCodeSelections.${index}`, "function", errors);
    checkRefs(selection.interfaceIds, interfaceIds, `customCodeSelections.${index}`, "interface", errors);
  });

  architecture.compatibilitySelections.forEach((selection, index) => {
    checkRefs([selection.compatibilityEdgeId], compatibilityEdgeIds, `compatibilitySelections.${index}`, "compatibility edge", errors);
    checkRefs([selection.interfaceId], interfaceIds, `compatibilitySelections.${index}`, "interface", errors);
    checkRefs(
      [
        ...selection.producerComponentIds,
        ...selection.consumerComponentIds,
        ...selection.adapterComponentIds,
      ],
      componentIds,
      `compatibilitySelections.${index}`,
      "component",
      errors,
    );
    checkRefs(selection.customCodeIds, customCodeIds, `compatibilitySelections.${index}`, "custom code", errors);
  });

  architecture.humanRoleSelections.forEach((selection, index) => {
    checkRefs([selection.humanRoleId], humanRoleIds, `humanRoleSelections.${index}`, "human role", errors);
  });
  architecture.dependencySelections.forEach((selection, index) => {
    checkRefs([selection.dependencyId], dependencyIds, `dependencySelections.${index}`, "external dependency", errors);
  });

  architecture.costEnvelope.lines.forEach((line, index) => {
    checkRefs(line.evidenceCellIds, evidenceIds, `costEnvelope.lines.${index}`, "evidence", errors);
  });

  const scheduleIds = new Set(
    architecture.scheduleEnvelope.lines.map((line) => line.id),
  );
  architecture.scheduleEnvelope.lines.forEach((line, index) => {
    checkRefs(line.predecessorIds, scheduleIds, `scheduleEnvelope.lines.${index}`, "schedule predecessor", errors);
  });

  architecture.risks.forEach((risk, index) => {
    checkRefs(risk.affectedFunctionIds, functionIds, `risks.${index}`, "function", errors);
    checkRefs(risk.affectedComponentIds, componentIds, `risks.${index}`, "component", errors);
    checkRefs(risk.evidenceCellIds, evidenceIds, `risks.${index}`, "evidence", errors);
  });

  architecture.residuals.forEach((residual, index) => {
    checkRefs(residual.sourceOptionIds, optionIds, `residuals.${index}`, "substitution option", errors);
    checkRefs(residual.sourceComponentIds, componentIds, `residuals.${index}`, "component", errors);
    checkRefs(residual.affectedFunctionIds, functionIds, `residuals.${index}`, "function", errors);
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: architecture };
}
