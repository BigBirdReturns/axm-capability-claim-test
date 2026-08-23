import { z } from "zod";
import type {
  ClaimPacket,
  GarpaValidationResult,
  MissionOutcome,
} from "../../types/garpa";
import type { CapabilityGraph } from "../../types/garpaCapability";

const interfaceType = z.enum([
  "data",
  "power",
  "mechanical",
  "network",
  "human",
  "environmental",
  "organizational",
]);

const functionClass = z.enum([
  "essential",
  "enabling",
  "coordination",
  "sustainment",
  "assurance",
  "vendor_specific",
]);

const functionState = z.enum([
  "required",
  "optional",
  "excluded",
  "unresolved",
]);

const functionOrigin = z.enum([
  "mission_derived",
  "evidence_derived",
  "vendor_specific",
]);

const automationLevel = z.enum([
  "manual",
  "decision_support",
  "supervised_automation",
  "bounded_autonomy",
  "unresolved",
]);

const ConstraintSetSchema = z
  .object({
    state: z.enum(["defined", "not_applicable", "unresolved"]),
    items: z.array(z.string()),
    note: z.string().optional(),
  })
  .strict();

const InterfaceSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    interfaceType,
    producerFunctionIds: z.array(z.string()),
    consumerFunctionIds: z.array(z.string()),
    externalSource: z.string().optional(),
    terminalPurpose: z.string().optional(),
    formatOrProtocol: z.string().optional(),
    rateOrCapacity: z.string().optional(),
    latencyConstraint: z.string().optional(),
    securityConstraint: z.string().optional(),
    evidenceCellIds: z.array(z.string()),
    limitations: z.array(z.string()),
  })
  .strict();

const FunctionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    purpose: z.string().min(1),
    functionClass,
    state: functionState,
    origin: functionOrigin,
    inputInterfaceIds: z.array(z.string()),
    outputInterfaceIds: z.array(z.string()),
    requirementKeys: z.array(z.string()),
    metricIds: z.array(z.string()),
    dependencyFunctionIds: z.array(z.string()),
    humanRoleIds: z.array(z.string()),
    automationLevel,
    requiresAuthorizationBoundary: z.boolean(),
    authorizationBoundary: z.string().optional(),
    operatingConstraints: z.array(z.string()),
    failureModes: z.array(z.string()),
    evidenceCellIds: z.array(z.string()),
    assumptions: z.array(z.string()),
    residualQuestions: z.array(z.string()),
  })
  .strict();

const TraceSchema = z
  .object({
    requirementKey: z.string().min(1),
    functionIds: z.array(z.string()).min(1),
    metricIds: z.array(z.string()),
    evidenceCellIds: z.array(z.string()),
  })
  .strict();

const HumanRoleSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    functionIds: z.array(z.string()).min(1),
    responsibilities: z.array(z.string()).min(1),
    authorityBoundary: z.string().optional(),
    training: z.array(z.string()).optional(),
    staffingAssumption: z.string().optional(),
    evidenceCellIds: z.array(z.string()),
  })
  .strict();

const ExternalDependencySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    dependencyType: z.enum([
      "infrastructure",
      "service",
      "data_source",
      "supplier",
      "authority",
      "other",
    ]),
    requiredByFunctionIds: z.array(z.string()).min(1),
    evidenceCellIds: z.array(z.string()),
    limitations: z.array(z.string()),
  })
  .strict();

const CapabilityGraphSchema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    missionOutcomeDigest: z.string().min(1),
    functions: z.array(FunctionSchema).min(1),
    interfaces: z.array(InterfaceSchema),
    traces: z.array(TraceSchema),
    humanRoles: z.array(HumanRoleSchema),
    externalDependencies: z.array(ExternalDependencySchema),
    constraintEnvelope: z
      .object({
        environment: ConstraintSetSchema,
        deployment: ConstraintSetSchema,
        resources: ConstraintSetSchema,
        governance: ConstraintSetSchema,
        economic: ConstraintSetSchema,
      })
      .strict(),
    exclusions: z.array(z.string()),
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

function checkEvidenceRefs(
  ids: string[],
  evidenceIds: ReadonlySet<string> | undefined,
  path: string,
  errors: string[],
): void {
  if (!evidenceIds) return;
  for (const id of ids) {
    if (!evidenceIds.has(id)) errors.push(`${path} references unknown evidence "${id}".`);
  }
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

  for (const [label, items] of [
    ["functions", graph.functions],
    ["interfaces", graph.interfaces],
    ["humanRoles", graph.humanRoles],
    ["externalDependencies", graph.externalDependencies],
  ] as const) {
    for (const id of duplicateIds(items)) errors.push(`${label} contains duplicate id "${id}".`);
  }

  const traceKeys = graph.traces.map((trace) => trace.requirementKey);
  const duplicateTraceKeys = traceKeys.filter(
    (key, index) => traceKeys.indexOf(key) !== index,
  );
  for (const key of new Set(duplicateTraceKeys)) {
    errors.push(`traces contains duplicate requirementKey "${key}".`);
  }

  const functionIds = new Set(graph.functions.map((fn) => fn.id));
  const interfaceIds = new Set(graph.interfaces.map((edge) => edge.id));
  const humanRoleIds = new Set(graph.humanRoles.map((role) => role.id));
  const evidenceIds = packet
    ? new Set(packet.evidence.map((cell) => cell.id))
    : undefined;
  const metricIds = outcome
    ? new Set(outcome.successMetrics.map((metric) => metric.id))
    : undefined;

  graph.functions.forEach((fn, index) => {
    for (const id of [...fn.inputInterfaceIds, ...fn.outputInterfaceIds]) {
      if (!interfaceIds.has(id)) {
        errors.push(`functions.${index} references unknown interface "${id}".`);
      }
    }
    for (const id of fn.dependencyFunctionIds) {
      if (!functionIds.has(id)) {
        errors.push(`functions.${index} references unknown dependency function "${id}".`);
      }
    }
    for (const id of fn.humanRoleIds) {
      if (!humanRoleIds.has(id)) {
        errors.push(`functions.${index} references unknown human role "${id}".`);
      }
    }
    if (metricIds) {
      for (const id of fn.metricIds) {
        if (!metricIds.has(id)) {
          errors.push(`functions.${index} references unknown mission metric "${id}".`);
        }
      }
    }
    checkEvidenceRefs(fn.evidenceCellIds, evidenceIds, `functions.${index}`, errors);
  });

  graph.interfaces.forEach((edge, index) => {
    for (const id of [...edge.producerFunctionIds, ...edge.consumerFunctionIds]) {
      if (!functionIds.has(id)) {
        errors.push(`interfaces.${index} references unknown function "${id}".`);
      }
    }
    checkEvidenceRefs(edge.evidenceCellIds, evidenceIds, `interfaces.${index}`, errors);
  });

  graph.traces.forEach((trace, index) => {
    for (const id of trace.functionIds) {
      if (!functionIds.has(id)) {
        errors.push(`traces.${index} references unknown function "${id}".`);
      }
    }
    if (metricIds) {
      for (const id of trace.metricIds) {
        if (!metricIds.has(id)) {
          errors.push(`traces.${index} references unknown mission metric "${id}".`);
        }
      }
    }
    checkEvidenceRefs(trace.evidenceCellIds, evidenceIds, `traces.${index}`, errors);
  });

  graph.humanRoles.forEach((role, index) => {
    for (const id of role.functionIds) {
      if (!functionIds.has(id)) {
        errors.push(`humanRoles.${index} references unknown function "${id}".`);
      }
    }
    checkEvidenceRefs(role.evidenceCellIds, evidenceIds, `humanRoles.${index}`, errors);
  });

  graph.externalDependencies.forEach((dependency, index) => {
    for (const id of dependency.requiredByFunctionIds) {
      if (!functionIds.has(id)) {
        errors.push(`externalDependencies.${index} references unknown function "${id}".`);
      }
    }
    checkEvidenceRefs(
      dependency.evidenceCellIds,
      evidenceIds,
      `externalDependencies.${index}`,
      errors,
    );
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: graph };
}
