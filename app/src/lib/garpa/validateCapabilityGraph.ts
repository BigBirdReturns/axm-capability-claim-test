import { z, type ZodError } from "zod";
import type {
  ClaimPacket,
  GarpaValidationResult,
  MissionOutcome,
} from "../../types/garpa";
import type { CapabilityGraph } from "../../types/garpaCapability";

const functionClass = z.enum([
  "essential",
  "enabling",
  "coordination",
  "sustainment",
  "assurance",
  "vendor_specific",
]);
const functionState = z.enum(["required", "optional", "excluded", "unresolved"]);
const automationLevel = z.enum([
  "manual",
  "decision_support",
  "supervised_automation",
  "bounded_autonomy",
]);
const consequenceClass = z.enum(["routine", "material", "safety_critical"]);
const interfaceType = z.enum([
  "data",
  "power",
  "mechanical",
  "network",
  "human",
  "environmental",
  "organizational",
]);
const dependencyType = z.enum([
  "sensor_or_input",
  "service",
  "infrastructure",
  "communications",
  "power",
  "operator_organization",
  "other",
]);
const missionTraceField = z.enum([
  "operator",
  "protected_or_affected_object",
  "problem_or_threat",
  "desired_state_change",
  "operating_environment",
  "time_and_coverage_requirement",
  "success_metric",
]);
const constraintState = z.enum(["complete", "partial", "open"]);

const CapabilityInterfaceSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    interfaceType,
    formatOrProtocol: z.string().optional(),
    rateOrCapacity: z.string().optional(),
    latencyConstraint: z.string().optional(),
    securityConstraint: z.string().optional(),
    externalProducerDependencyIds: z.array(z.string()).default([]),
    externalConsumerDependencyIds: z.array(z.string()).default([]),
    terminal: z.boolean().default(false),
    evidenceCellIds: z.array(z.string()).default([]),
    limitations: z.array(z.string()).default([]),
  })
  .strict();

const CapabilityFunctionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    purpose: z.string().min(1),
    functionClass,
    state: functionState,
    inputInterfaceIds: z.array(z.string()).default([]),
    outputInterfaceIds: z.array(z.string()).default([]),
    functionDependencyIds: z.array(z.string()).default([]),
    externalDependencyIds: z.array(z.string()).default([]),
    automationLevel,
    humanRoleIds: z.array(z.string()).default([]),
    consequenceClass,
    authorityBoundary: z.string().optional(),
    evidenceCellIds: z.array(z.string()).default([]),
    assumptions: z.array(z.string()).default([]),
    failureModes: z.array(z.string()).default([]),
    residualQuestions: z.array(z.string()).default([]),
  })
  .strict();

const HumanRoleSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    responsibilities: z.array(z.string()).min(1),
    authorityBoundary: z.string().optional(),
    staffingAssumption: z.string().optional(),
    trainingRequirements: z.array(z.string()).default([]),
    evidenceCellIds: z.array(z.string()).default([]),
    limitations: z.array(z.string()).default([]),
  })
  .strict();

const ExternalDependencySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    dependencyType,
    required: z.boolean(),
    provider: z.string().optional(),
    evidenceCellIds: z.array(z.string()).default([]),
    limitations: z.array(z.string()).default([]),
  })
  .strict();

const RequirementTraceSchema = z
  .object({
    id: z.string().min(1),
    missionField: missionTraceField,
    metricId: z.string().optional(),
    functionIds: z.array(z.string()).min(1),
    evidenceCellIds: z.array(z.string()).default([]),
    rationale: z.string().min(1),
  })
  .strict()
  .superRefine((
    trace: { missionField: string; metricId?: string },
    ctx: { addIssue: (issue: unknown) => void },
  ) => {
    if (trace.missionField === "success_metric" && !trace.metricId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["metricId"],
        message: "success_metric traces require metricId.",
      });
    }
    if (trace.missionField !== "success_metric" && trace.metricId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["metricId"],
        message: "metricId is permitted only for success_metric traces.",
      });
    }
  });

const ConstraintSectionSchema = z
  .object({
    state: constraintState,
    statements: z.array(z.string()).default([]),
    openQuestions: z.array(z.string()).default([]),
    evidenceCellIds: z.array(z.string()).default([]),
  })
  .strict();

const FeedbackLoopSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    functionIds: z.array(z.string()).min(1),
    interfaceIds: z.array(z.string()).min(1),
    rationale: z.string().min(1),
  })
  .strict();

const CapabilityGraphSchema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    missionOutcomeDigest: z.string().min(1),
    functions: z.array(CapabilityFunctionSchema).min(1),
    interfaces: z.array(CapabilityInterfaceSchema).min(1),
    traces: z.array(RequirementTraceSchema).min(1),
    humanRoles: z.array(HumanRoleSchema).default([]),
    externalDependencies: z.array(ExternalDependencySchema).default([]),
    constraintEnvelope: z
      .object({
        environment: ConstraintSectionSchema,
        deployment: ConstraintSectionSchema,
        resources: ConstraintSectionSchema,
        governance: ConstraintSectionSchema,
        economic: ConstraintSectionSchema,
      })
      .strict(),
    feedbackLoops: z.array(FeedbackLoopSchema).default([]),
    exclusions: z.array(z.string()).default([]),
    generatedAt: z.string().min(1),
  })
  .strict();

function formatIssues(error: ZodError): string[] {
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

function duplicateStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export function validateCapabilityGraph(
  input: unknown,
  packet?: ClaimPacket,
  outcome?: MissionOutcome,
): GarpaValidationResult<CapabilityGraph> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };

  const parsed = CapabilityGraphSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const graph = parsed.data as CapabilityGraph;
  const errors: string[] = [];
  const collections: Array<[string, { id: string }[]]> = [
    ["functions", graph.functions],
    ["interfaces", graph.interfaces],
    ["traces", graph.traces],
    ["humanRoles", graph.humanRoles],
    ["externalDependencies", graph.externalDependencies],
    ["feedbackLoops", graph.feedbackLoops],
  ];
  for (const [label, items] of collections) {
    for (const id of duplicateIds(items)) {
      errors.push(`${label} contains duplicate id "${id}".`);
    }
  }

  const functionIds = new Set(graph.functions.map((fn) => fn.id));
  const interfaceIds = new Set(graph.interfaces.map((interf) => interf.id));
  const humanRoleIds = new Set(graph.humanRoles.map((role) => role.id));
  const externalDependencyIds = new Set(
    graph.externalDependencies.map((dependency) => dependency.id),
  );
  const metricIds = new Set(outcome?.successMetrics.map((metric) => metric.id) ?? []);
  const evidenceIds = packet
    ? new Set(packet.evidence.map((cell) => cell.id))
    : undefined;

  function checkEvidence(ids: string[], path: string): void {
    if (!evidenceIds) return;
    for (const id of ids) {
      if (!evidenceIds.has(id)) errors.push(`${path} references unknown evidence "${id}".`);
    }
  }

  graph.functions.forEach((fn, index) => {
    for (const [label, values] of [
      ["inputInterfaceIds", fn.inputInterfaceIds],
      ["outputInterfaceIds", fn.outputInterfaceIds],
      ["functionDependencyIds", fn.functionDependencyIds],
      ["externalDependencyIds", fn.externalDependencyIds],
      ["humanRoleIds", fn.humanRoleIds],
    ] as const) {
      for (const value of duplicateStrings(values)) {
        errors.push(`functions.${index}.${label} contains duplicate id "${value}".`);
      }
    }
    for (const id of [...fn.inputInterfaceIds, ...fn.outputInterfaceIds]) {
      if (!interfaceIds.has(id)) errors.push(`functions.${index} references unknown interface "${id}".`);
    }
    for (const id of fn.functionDependencyIds) {
      if (!functionIds.has(id)) errors.push(`functions.${index} references unknown function "${id}".`);
      if (id === fn.id) errors.push(`functions.${index} cannot depend on itself.`);
    }
    for (const id of fn.externalDependencyIds) {
      if (!externalDependencyIds.has(id)) {
        errors.push(`functions.${index} references unknown external dependency "${id}".`);
      }
    }
    for (const id of fn.humanRoleIds) {
      if (!humanRoleIds.has(id)) errors.push(`functions.${index} references unknown human role "${id}".`);
    }
    checkEvidence(fn.evidenceCellIds, `functions.${index}.evidenceCellIds`);
  });

  graph.interfaces.forEach((interf, index) => {
    for (const id of [
      ...interf.externalProducerDependencyIds,
      ...interf.externalConsumerDependencyIds,
    ]) {
      if (!externalDependencyIds.has(id)) {
        errors.push(`interfaces.${index} references unknown external dependency "${id}".`);
      }
    }
    checkEvidence(interf.evidenceCellIds, `interfaces.${index}.evidenceCellIds`);
  });

  graph.traces.forEach((trace, index) => {
    for (const id of trace.functionIds) {
      if (!functionIds.has(id)) errors.push(`traces.${index} references unknown function "${id}".`);
    }
    if (trace.metricId && outcome && !metricIds.has(trace.metricId)) {
      errors.push(`traces.${index} references unknown success metric "${trace.metricId}".`);
    }
    checkEvidence(trace.evidenceCellIds, `traces.${index}.evidenceCellIds`);
  });

  graph.humanRoles.forEach((role, index) => {
    checkEvidence(role.evidenceCellIds, `humanRoles.${index}.evidenceCellIds`);
  });
  graph.externalDependencies.forEach((dependency, index) => {
    checkEvidence(
      dependency.evidenceCellIds,
      `externalDependencies.${index}.evidenceCellIds`,
    );
  });

  for (const [sectionName, section] of Object.entries(graph.constraintEnvelope)) {
    checkEvidence(
      section.evidenceCellIds,
      `constraintEnvelope.${sectionName}.evidenceCellIds`,
    );
  }

  graph.feedbackLoops.forEach((loop, index) => {
    for (const id of loop.functionIds) {
      if (!functionIds.has(id)) {
        errors.push(`feedbackLoops.${index} references unknown function "${id}".`);
      }
    }
    for (const id of loop.interfaceIds) {
      if (!interfaceIds.has(id)) {
        errors.push(`feedbackLoops.${index} references unknown interface "${id}".`);
      }
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: graph };
}
