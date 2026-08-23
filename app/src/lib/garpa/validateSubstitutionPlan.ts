import { z } from "zod";
import type { ClaimPacket, GarpaValidationResult } from "../../types/garpa";
import type { CapabilityGraph } from "../../types/garpaCapability";
import type { SubstitutionPlan } from "../../types/garpaSubstitution";

const ComponentSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum([
      "commercial_hardware",
      "open_hardware",
      "software_package",
      "open_source_project",
      "service",
      "human_role",
      "custom_code",
      "custom_fabrication",
      "test_equipment",
      "external_dependency",
    ]),
    manufacturer: z.string().optional(),
    product: z.string().min(1),
    exactModelOrVersion: z.string().min(1),
    functionIds: z.array(z.string()),
    interfaceIds: z.array(z.string()),
    maturity: z.enum([
      "vendor_claimed",
      "community_reported",
      "independently_reported",
      "bench_reproduced",
      "field_reproduced",
      "locally_qualified",
    ]),
    identityEvidenceCellIds: z.array(z.string()).min(1),
    performanceEvidenceCellIds: z.array(z.string()),
    licenseEvidenceCellIds: z.array(z.string()),
    performanceEnvelope: z.record(z.string()),
    operatingRequirements: z.record(z.string()),
    license: z.string().optional(),
    sourceAvailability: z.string().optional(),
    securityNotes: z.array(z.string()),
    price: z
      .object({
        amount: z.number().nonnegative(),
        currency: z.string().min(1),
        capturedAt: z.string().min(1),
        evidenceCellIds: z.array(z.string()).min(1),
        includedCostCategories: z.array(z.string()),
        excludedCostCategories: z.array(z.string()),
      })
      .strict()
      .optional(),
    availability: z
      .object({
        state: z.enum(["in_stock", "limited", "lead_time", "unavailable", "unknown"]),
        capturedAt: z.string().min(1),
        evidenceCellIds: z.array(z.string()).min(1),
        note: z.string().optional(),
      })
      .strict()
      .optional(),
    integrationRequirements: z.array(z.string()),
    limitations: z.array(z.string()),
    residuals: z.array(z.string()),
    lifecycle: z.enum([
      "available",
      "limited",
      "end_of_life",
      "unverified",
      "superseded",
    ]),
  })
  .strict();

const CustomCodeSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    functionIds: z.array(z.string()),
    interfaceIds: z.array(z.string()),
    purpose: z.string().min(1),
    inputs: z.array(z.string()),
    outputs: z.array(z.string()),
    complexity: z.enum([
      "small",
      "bounded",
      "substantial",
      "research_grade",
      "unresolved",
    ]),
    dependencies: z.array(z.string()),
    testStrategy: z.array(z.string()),
    safetyProperties: z.array(z.string()),
    securityProperties: z.array(z.string()),
    residuals: z.array(z.string()),
  })
  .strict();

const CompatibilityEdgeSchema = z
  .object({
    id: z.string().min(1),
    interfaceId: z.string().min(1),
    producerComponentIds: z.array(z.string()),
    consumerComponentIds: z.array(z.string()),
    state: z.enum([
      "confirmed_compatible",
      "reported_compatible",
      "adapter_required",
      "experimental",
      "incompatible",
      "unknown",
    ]),
    adapterComponentIds: z.array(z.string()),
    customCodeIds: z.array(z.string()),
    evidenceCellIds: z.array(z.string()),
    limitations: z.array(z.string()),
    falsificationTest: z.string(),
  })
  .strict();

const OptionSchema = z
  .object({
    id: z.string().min(1),
    functionId: z.string().min(1),
    componentIds: z.array(z.string()),
    customCodeIds: z.array(z.string()),
    coverage: z.enum([
      "complete_candidate",
      "partial_candidate",
      "experimental",
      "uncovered",
    ]),
    maturity: z.enum(["established", "reported", "experimental", "unknown"]),
    composition: z.string(),
    integrationWork: z.array(z.string()),
    evidenceCellIds: z.array(z.string()),
    residuals: z.array(z.string()),
    falsificationTest: z.string(),
  })
  .strict();

const SubstitutionPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    capabilityGraphDigest: z.string().min(1),
    components: z.array(ComponentSchema),
    customCode: z.array(CustomCodeSchema),
    compatibilityEdges: z.array(CompatibilityEdgeSchema),
    options: z.array(OptionSchema),
    costBoundary: z
      .object({
        state: z.enum(["complete", "partial", "unresolved"]),
        currency: z.string().optional(),
        evaluationPeriod: z.string().optional(),
        includedCategories: z.array(z.string()),
        excludedCategories: z.array(z.string()),
        note: z.string().optional(),
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

export function validateSubstitutionPlan(
  input: unknown,
  graph: CapabilityGraph,
  packet: ClaimPacket,
): GarpaValidationResult<SubstitutionPlan> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };

  const parsed = SubstitutionPlanSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const plan = parsed.data as SubstitutionPlan;
  const errors: string[] = [];
  for (const [label, items] of [
    ["components", plan.components],
    ["customCode", plan.customCode],
    ["compatibilityEdges", plan.compatibilityEdges],
    ["options", plan.options],
  ] as const) {
    for (const id of duplicateIds(items)) errors.push(`${label} contains duplicate id "${id}".`);
  }

  const functionIds = new Set(graph.functions.map((fn) => fn.id));
  const interfaceIds = new Set(graph.interfaces.map((edge) => edge.id));
  const componentIds = new Set(plan.components.map((component) => component.id));
  const customCodeIds = new Set(plan.customCode.map((code) => code.id));
  const evidenceIds = new Set(packet.evidence.map((cell) => cell.id));

  plan.components.forEach((component, index) => {
    checkRefs(component.functionIds, functionIds, `components.${index}`, "function", errors);
    checkRefs(component.interfaceIds, interfaceIds, `components.${index}`, "interface", errors);
    checkRefs(
      [
        ...component.identityEvidenceCellIds,
        ...component.performanceEvidenceCellIds,
        ...component.licenseEvidenceCellIds,
        ...(component.price?.evidenceCellIds ?? []),
        ...(component.availability?.evidenceCellIds ?? []),
      ],
      evidenceIds,
      `components.${index}`,
      "evidence",
      errors,
    );
  });

  plan.customCode.forEach((code, index) => {
    checkRefs(code.functionIds, functionIds, `customCode.${index}`, "function", errors);
    checkRefs(code.interfaceIds, interfaceIds, `customCode.${index}`, "interface", errors);
  });

  plan.compatibilityEdges.forEach((edge, index) => {
    checkRefs([edge.interfaceId], interfaceIds, `compatibilityEdges.${index}`, "interface", errors);
    checkRefs(
      [...edge.producerComponentIds, ...edge.consumerComponentIds, ...edge.adapterComponentIds],
      componentIds,
      `compatibilityEdges.${index}`,
      "component",
      errors,
    );
    checkRefs(
      edge.customCodeIds,
      customCodeIds,
      `compatibilityEdges.${index}`,
      "custom code",
      errors,
    );
    checkRefs(
      edge.evidenceCellIds,
      evidenceIds,
      `compatibilityEdges.${index}`,
      "evidence",
      errors,
    );
  });

  plan.options.forEach((option, index) => {
    checkRefs([option.functionId], functionIds, `options.${index}`, "function", errors);
    checkRefs(option.componentIds, componentIds, `options.${index}`, "component", errors);
    checkRefs(option.customCodeIds, customCodeIds, `options.${index}`, "custom code", errors);
    checkRefs(option.evidenceCellIds, evidenceIds, `options.${index}`, "evidence", errors);
    for (const componentId of option.componentIds) {
      const component = plan.components.find((candidate) => candidate.id === componentId);
      if (component && !component.functionIds.includes(option.functionId)) {
        errors.push(
          `options.${index} uses component "${componentId}" outside its declared function coverage.`,
        );
      }
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: plan };
}
