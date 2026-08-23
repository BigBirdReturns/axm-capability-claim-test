import type {
  ArchitecturePattern,
  CapabilityPrimitive,
  ComponentObservation,
} from "../../types/garpaCommons";
import type {
  CapabilityGraph,
  CapabilityInterface,
} from "../../types/garpaCapability";
import type {
  CommonsCatalogObjectType,
  CommonsCatalogSearchQuery,
} from "../../types/garpaCommonsCatalog";
import type {
  CommonsRetrievalCandidateHit,
  CommonsRetrievalExecutionResult,
  CommonsRetrievalPlan,
  CommonsRetrievalPlanBuildRequest,
  CommonsRetrievalPlanBuildResult,
  CommonsRetrievalTask,
  CommonsTransferUse,
} from "../../types/garpaCommonsTransfer";
import { canonicalStringify } from "./canonicalJson";
import {
  computeCapabilityGraphDigest,
  computeCommonsRetrievalPlanDigest,
  computeGraphAdmissionReceiptDigest,
} from "./commonsCaseTransferDigest";
import { searchCommonsCatalog } from "./searchCommonsCatalog";
import {
  findCatalogEntry,
  validateCommonsCatalog,
} from "./validateCommonsCatalog";
import { validateCapabilityGraph } from "./validateCapabilityGraph";
import { validateCommonsRetrievalPlan } from "./validateCommonsTransfer";

const ALL_OBJECT_TYPES: CommonsCatalogObjectType[] = [
  "primitive",
  "component_observation",
  "architecture_pattern",
];

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "before",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "to",
  "under",
  "with",
]);

export const COMMONS_TRANSFER_PROHIBITED_TRANSITIONS = [
  "A commons hit cannot become admitted component evidence without target-case evidence retrieval and validation.",
  "A commons hit cannot establish compatibility, function coverage, or interface coverage in the target case.",
  "A commons hit cannot select a candidate architecture or satisfy the architecture gate.",
  "A commons hit cannot establish qualification, procurement authority, test authority, deployment authority, or mission equivalence.",
] as const;

function normalizeTerms(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((item) => item.trim())
    .filter(
      (item) =>
        item.length >= 3 &&
        !STOP_WORDS.has(item) &&
        !/^\d+$/.test(item),
    );
}

function searchTerms(...values: string[]): string[] {
  const terms = Array.from(new Set(values.flatMap(normalizeTerms)));
  return terms.slice(0, 8);
}

function taskQueries(
  targetKind: CommonsRetrievalTask["targetKind"],
  targetId: string,
  terms: string[],
  permittedObjectTypes: CommonsCatalogObjectType[],
): CommonsCatalogSearchQuery[] {
  const structured = targetKind === "function"
    ? { functionIds: [targetId] }
    : { interfaceIds: [targetId] };
  return [
    {
      objectTypes: permittedObjectTypes,
      ...structured,
      limit: 100,
    },
    ...terms.map((term) => ({
      text: term,
      objectTypes: permittedObjectTypes,
      limit: 100,
    })),
  ];
}

function functionTask(
  fn: CapabilityGraph["functions"][number],
): CommonsRetrievalTask {
  const terms = searchTerms(fn.name, fn.purpose, ...fn.operatingConstraints);
  return {
    taskId: `function:${fn.id}`,
    targetKind: "function",
    targetId: fn.id,
    targetLabel: fn.name,
    searchTerms: terms,
    permittedObjectTypes: ALL_OBJECT_TYPES,
    queries: taskQueries("function", fn.id, terms, ALL_OBJECT_TYPES),
  };
}

function interfaceTask(edge: CapabilityInterface): CommonsRetrievalTask {
  const terms = searchTerms(
    edge.name,
    edge.formatOrProtocol ?? "",
    edge.externalSource ?? "",
    edge.terminalPurpose ?? "",
  );
  return {
    taskId: `interface:${edge.id}`,
    targetKind: "interface",
    targetId: edge.id,
    targetLabel: edge.name,
    searchTerms: terms,
    permittedObjectTypes: ALL_OBJECT_TYPES,
    queries: taskQueries("interface", edge.id, terms, ALL_OBJECT_TYPES),
  };
}

function suggestedUse(objectType: CommonsCatalogObjectType): CommonsTransferUse {
  if (objectType === "primitive") return "capability_decomposition_hint";
  if (objectType === "component_observation") return "component_retrieval_lead";
  return "architecture_pattern_hint";
}

export function buildCommonsRetrievalPlan(
  request: CommonsRetrievalPlanBuildRequest,
): CommonsRetrievalPlanBuildResult {
  const errors: string[] = [];
  const catalog = validateCommonsCatalog(request.catalog);
  if (!catalog.ok || !catalog.value) {
    errors.push(...catalog.errors.map((error) => `catalog: ${error}`));
  }
  const graph = validateCapabilityGraph(request.targetCapabilityGraph);
  if (!graph.ok || !graph.value) {
    errors.push(...graph.errors.map((error) => `targetCapabilityGraph: ${error}`));
  }

  if (catalog.value && request.expectedCatalogDigest !== catalog.value.catalogDigest) {
    errors.push("expectedCatalogDigest does not match the validated catalog.");
  }
  if (graph.value) {
    const digest = computeCapabilityGraphDigest(graph.value);
    if (digest !== request.targetCapabilityGraphDigest) {
      errors.push("targetCapabilityGraphDigest does not match the canonical graph digest.");
    }
  }

  const receipt = request.targetGraphAdmissionReceipt;
  const expectedReceiptDigest = computeGraphAdmissionReceiptDigest({
    receiptId: receipt.receiptId,
    capabilityGraphDigest: receipt.capabilityGraphDigest,
    passed: receipt.passed,
    state: receipt.state,
  });
  if (receipt.receiptDigest !== expectedReceiptDigest) {
    errors.push("targetGraphAdmissionReceipt digest is invalid.");
  }
  if (receipt.capabilityGraphDigest !== request.targetCapabilityGraphDigest) {
    errors.push("targetGraphAdmissionReceipt references a different capability graph.");
  }
  if (!receipt.passed || receipt.state !== "admitted_for_substitution") {
    errors.push("The target capability graph is not admitted for substitution.");
  }

  if (errors.length > 0 || !catalog.value || !graph.value) {
    return { passed: false, errors: Array.from(new Set(errors)) };
  }

  const requiredFunctions = graph.value.functions.filter(
    (fn) => fn.state === "required" && fn.functionClass !== "vendor_specific",
  );
  if (requiredFunctions.length === 0) {
    return {
      passed: false,
      errors: ["The admitted graph contains no reusable required functions."],
    };
  }
  const requiredFunctionIds = new Set(requiredFunctions.map((fn) => fn.id));
  const requiredInterfaces = graph.value.interfaces.filter((edge) =>
    [...edge.producerFunctionIds, ...edge.consumerFunctionIds].some((id) =>
      requiredFunctionIds.has(id),
    ),
  );

  const tasks = [
    ...requiredFunctions.map(functionTask),
    ...requiredInterfaces.map(interfaceTask),
  ];
  const content: Omit<CommonsRetrievalPlan, "planDigest"> = {
    schemaVersion: 1,
    planId: `commons-retrieval:${graph.value.caseId}:${request.targetCapabilityGraphDigest.slice(0, 16)}`,
    catalogId: catalog.value.catalogId,
    catalogDigest: catalog.value.catalogDigest,
    caseId: graph.value.caseId,
    capabilityGraphDigest: request.targetCapabilityGraphDigest,
    graphAdmissionReceiptId: receipt.receiptId,
    tasks,
    prohibitedTransitions: [...COMMONS_TRANSFER_PROHIBITED_TRANSITIONS],
  };
  return {
    passed: true,
    errors: [],
    plan: {
      ...content,
      planDigest: computeCommonsRetrievalPlanDigest(content),
    },
  };
}

interface MutableHit extends CommonsRetrievalCandidateHit {
  taskIdSet: Set<string>;
  functionIdSet: Set<string>;
  interfaceIdSet: Set<string>;
}

export function executeCommonsRetrievalPlan(
  catalogInput: unknown,
  planInput: unknown,
): CommonsRetrievalExecutionResult {
  const catalog = validateCommonsCatalog(catalogInput);
  const plan = validateCommonsRetrievalPlan(planInput);
  const errors = [
    ...catalog.errors.map((error) => `catalog: ${error}`),
    ...plan.errors.map((error) => `plan: ${error}`),
  ];
  if (!catalog.ok || !catalog.value || !plan.ok || !plan.value) {
    return {
      passed: false,
      errors,
      planId: plan.value?.planId ?? "unresolved",
      planDigest: plan.value?.planDigest ?? "unresolved",
      catalogDigest: catalog.value?.catalogDigest ?? "unresolved",
      candidateHits: [],
    };
  }
  if (
    plan.value.catalogId !== catalog.value.catalogId ||
    plan.value.catalogDigest !== catalog.value.catalogDigest
  ) {
    return {
      passed: false,
      errors: ["The retrieval plan does not reference the supplied catalog revision."],
      planId: plan.value.planId,
      planDigest: plan.value.planDigest,
      catalogDigest: catalog.value.catalogDigest,
      candidateHits: [],
    };
  }

  const collected = new Map<string, MutableHit>();
  for (const task of plan.value.tasks) {
    for (const query of task.queries) {
      const result = searchCommonsCatalog(catalog.value, query);
      for (const hit of result.hits) {
        const entry = findCatalogEntry(
          catalog.value,
          hit.objectType,
          hit.catalogObjectId,
        );
        const revision = entry?.revisions.find(
          (item) => item.revisionId === hit.revisionId,
        );
        if (!revision) continue;
        const key = `${hit.objectType}:${hit.revisionId}`;
        const existing = collected.get(key);
        if (existing) {
          existing.taskIdSet.add(task.taskId);
          if (task.targetKind === "function") existing.functionIdSet.add(task.targetId);
          else existing.interfaceIdSet.add(task.targetId);
          continue;
        }
        collected.set(key, {
          objectType: hit.objectType,
          catalogObjectId: hit.catalogObjectId,
          revisionId: hit.revisionId,
          revisionNumber: hit.revisionNumber,
          revisionState: hit.revisionState,
          objectDigest: revision.objectDigest,
          displayName: hit.displayName,
          sourceCaseId: hit.sourceCaseId,
          sourceReleaseId: hit.sourceReleaseId,
          sourceReleaseDigest: hit.sourceReleaseDigest,
          retrievalTaskIds: [],
          targetFunctionIds: [],
          targetInterfaceIds: [],
          suggestedUse: suggestedUse(hit.objectType),
          hit,
          taskIdSet: new Set([task.taskId]),
          functionIdSet: new Set(
            task.targetKind === "function" ? [task.targetId] : [],
          ),
          interfaceIdSet: new Set(
            task.targetKind === "interface" ? [task.targetId] : [],
          ),
        });
      }
    }
  }

  const candidateHits = [...collected.values()]
    .map(({ taskIdSet, functionIdSet, interfaceIdSet, ...hit }) => ({
      ...hit,
      retrievalTaskIds: [...taskIdSet].sort(),
      targetFunctionIds: [...functionIdSet].sort(),
      targetInterfaceIds: [...interfaceIdSet].sort(),
    }))
    .sort(
      (left, right) =>
        left.objectType.localeCompare(right.objectType) ||
        left.catalogObjectId.localeCompare(right.catalogObjectId) ||
        right.revisionNumber - left.revisionNumber,
    );

  return {
    passed: true,
    errors: [],
    planId: plan.value.planId,
    planDigest: plan.value.planDigest,
    catalogDigest: catalog.value.catalogDigest,
    candidateHits,
  };
}

export function retrievalPlanMatches(
  left: CommonsRetrievalPlan,
  right: CommonsRetrievalPlan,
): boolean {
  return canonicalStringify(left) === canonicalStringify(right);
}

export type CommonsSourceValue =
  | CapabilityPrimitive
  | ComponentObservation
  | ArchitecturePattern;
