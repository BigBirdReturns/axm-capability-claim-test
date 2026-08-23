import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type {
  CapabilityGraphAdmissionReceipt,
  CommonsRetrievalPlan,
  CommonsTransferRequest,
} from "../../types/garpaCommonsTransfer";
import {
  computeCommonsRetrievalPlanDigest,
  computeGraphAdmissionReceiptDigest,
} from "./commonsCaseTransferDigest";
import { validateCapabilityGraph } from "./validateCapabilityGraph";
import { validateCommonsCatalog } from "./validateCommonsCatalog";

const SHA256 = /^[a-f0-9]{64}$/i;

const objectType = z.enum([
  "primitive",
  "component_observation",
  "architecture_pattern",
]);
const executionClass = z.enum([
  "E0_analysis_only",
  "E1_simulation_or_replay",
  "E2_bench_passive",
  "E3_controlled_field_inert",
  "E4_regulated_active",
  "E5_operational_environment",
]);
const graphGateState = z.enum([
  "goal_not_admitted",
  "mission_digest_mismatch",
  "mission_trace_incomplete",
  "essential_function_unresolved",
  "interface_graph_incomplete",
  "human_role_missing",
  "constraint_envelope_incomplete",
  "authorization_boundary_missing",
  "vendor_architecture_leakage",
  "admitted_for_substitution",
]);
const transferUse = z.enum([
  "capability_decomposition_hint",
  "component_retrieval_lead",
  "architecture_pattern_hint",
]);
const environmentComparison = z.enum([
  "same",
  "partial_overlap",
  "different",
  "unknown",
]);
const executionComparison = z.enum([
  "source_same_or_stronger",
  "target_more_demanding",
  "unknown",
]);

const SearchQuerySchema = z
  .object({
    text: z.string().optional(),
    objectTypes: z.array(objectType).optional(),
    sourceCaseIds: z.array(z.string().min(1)).optional(),
    sourceReleaseIds: z.array(z.string().min(1)).optional(),
    functionIds: z.array(z.string().min(1)).optional(),
    interfaceIds: z.array(z.string().min(1)).optional(),
    executionClasses: z.array(executionClass).optional(),
    primitiveMaturities: z
      .array(
        z.enum([
          "concept",
          "candidate",
          "bench_observed",
          "field_observed",
          "repeated",
        ]),
      )
      .optional(),
    componentStates: z
      .array(
        z.enum([
          "vendor_claimed",
          "externally_reported",
          "locally_observed",
          "locally_qualified",
        ]),
      )
      .optional(),
    includeSuperseded: z.boolean().optional(),
    includeWithdrawn: z.boolean().optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .strict();

const GraphAdmissionReceiptSchema = z
  .object({
    receiptId: z.string().min(1),
    capabilityGraphDigest: z.string().regex(SHA256),
    passed: z.boolean(),
    state: graphGateState,
    receiptDigest: z.string().regex(SHA256),
  })
  .strict();

const RetrievalTaskSchema = z
  .object({
    taskId: z.string().min(1),
    targetKind: z.enum(["function", "interface"]),
    targetId: z.string().min(1),
    targetLabel: z.string().min(1),
    searchTerms: z.array(z.string().min(1)).min(1),
    permittedObjectTypes: z.array(objectType).min(1),
    queries: z.array(SearchQuerySchema).min(1),
  })
  .strict();

const RetrievalPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    planId: z.string().min(1),
    catalogId: z.string().min(1),
    catalogDigest: z.string().regex(SHA256),
    caseId: z.string().min(1),
    capabilityGraphDigest: z.string().regex(SHA256),
    graphAdmissionReceiptId: z.string().min(1),
    tasks: z.array(RetrievalTaskSchema).min(1),
    prohibitedTransitions: z.array(z.string().min(1)).min(1),
    planDigest: z.string().regex(SHA256),
  })
  .strict();

const NominationSchema = z
  .object({
    nominationId: z.string().min(1),
    objectType,
    catalogObjectId: z.string().min(1),
    revisionId: z.string().min(1),
    objectDigest: z.string().regex(SHA256),
    retrievalTaskIds: z.array(z.string().min(1)).min(1),
    requestedUse: transferUse,
    targetFunctionIds: z.array(z.string().min(1)).min(1),
    targetInterfaceIds: z.array(z.string().min(1)),
    mappingRationale: z.string().min(1),
    declaredEnvironmentComparison: environmentComparison,
    declaredExecutionComparison: executionComparison,
    knownMismatches: z.array(z.string().min(1)),
    acknowledgedResiduals: z.array(z.string().min(1)),
    acknowledgedLimitations: z.array(z.string().min(1)),
    acknowledgedFalsificationConditions: z.array(z.string().min(1)),
    acknowledgedFailureModes: z.array(z.string().min(1)),
    requiredEvidencePulls: z.array(z.string().min(1)).min(1),
    requiredQualificationTests: z.array(z.string().min(1)),
  })
  .strict();

const TransferRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    catalog: z.unknown(),
    expectedCatalogDigest: z.string().regex(SHA256),
    targetCapabilityGraph: z.unknown(),
    targetCapabilityGraphDigest: z.string().regex(SHA256),
    targetGraphAdmissionReceipt: GraphAdmissionReceiptSchema,
    retrievalPlan: RetrievalPlanSchema,
    targetEnvironment: z.record(z.string()),
    targetExecutionClass: executionClass.optional(),
    allowHistoricalResearch: z.boolean(),
    nominations: z.array(NominationSchema).min(1),
    createdAt: z.string().min(1),
  })
  .strict();

function parseInput(input: unknown): GarpaValidationResult<unknown> {
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

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

export function validateGraphAdmissionReceipt(
  input: unknown,
): GarpaValidationResult<CapabilityGraphAdmissionReceipt> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  const parsed = GraphAdmissionReceiptSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };
  const receipt = parsed.data as CapabilityGraphAdmissionReceipt;
  const expected = computeGraphAdmissionReceiptDigest({
    receiptId: receipt.receiptId,
    capabilityGraphDigest: receipt.capabilityGraphDigest,
    passed: receipt.passed,
    state: receipt.state,
  });
  if (receipt.receiptDigest !== expected) {
    return { ok: false, errors: ["receiptDigest does not match the canonical admission receipt."] };
  }
  return { ok: true, errors: [], value: receipt };
}

export function validateCommonsRetrievalPlan(
  input: unknown,
): GarpaValidationResult<CommonsRetrievalPlan> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  const parsed = RetrievalPlanSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };
  const plan = parsed.data as CommonsRetrievalPlan;
  const errors: string[] = [];
  for (const duplicate of duplicates(plan.tasks.map((task) => task.taskId))) {
    errors.push(`tasks contains duplicate taskId "${duplicate}".`);
  }
  for (const task of plan.tasks) {
    for (const duplicate of duplicates(task.searchTerms)) {
      errors.push(`task ${task.taskId} contains duplicate search term "${duplicate}".`);
    }
  }
  const { planDigest: _planDigest, ...content } = plan;
  if (computeCommonsRetrievalPlanDigest(content) !== plan.planDigest) {
    errors.push("planDigest does not match the canonical retrieval plan.");
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: plan };
}

export function validateCommonsTransferRequest(
  input: unknown,
): GarpaValidationResult<CommonsTransferRequest> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  const parsed = TransferRequestSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const data = parsed.data;
  const catalog = validateCommonsCatalog(data.catalog);
  const graph = validateCapabilityGraph(data.targetCapabilityGraph);
  const receipt = validateGraphAdmissionReceipt(data.targetGraphAdmissionReceipt);
  const plan = validateCommonsRetrievalPlan(data.retrievalPlan);
  const errors = [
    ...catalog.errors.map((error) => `catalog: ${error}`),
    ...graph.errors.map((error) => `targetCapabilityGraph: ${error}`),
    ...receipt.errors.map((error) => `targetGraphAdmissionReceipt: ${error}`),
    ...plan.errors.map((error) => `retrievalPlan: ${error}`),
  ];

  if (!Number.isFinite(Date.parse(data.createdAt))) {
    errors.push("createdAt must be a valid date-time string.");
  }
  for (const duplicate of duplicates(
    data.nominations.map((nomination) => nomination.nominationId),
  )) {
    errors.push(`nominations contains duplicate nominationId "${duplicate}".`);
  }
  if (
    receipt.value &&
    plan.value &&
    plan.value.graphAdmissionReceiptId !== receipt.value.receiptId
  ) {
    errors.push("retrievalPlan references a different graph admission receipt.");
  }

  if (
    errors.length > 0 ||
    !catalog.value ||
    !graph.value ||
    !receipt.value ||
    !plan.value
  ) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }
  return {
    ok: true,
    errors: [],
    value: {
      ...(data as unknown as CommonsTransferRequest),
      catalog: catalog.value,
      targetCapabilityGraph: graph.value,
      targetGraphAdmissionReceipt: receipt.value,
      retrievalPlan: plan.value,
    },
  };
}
