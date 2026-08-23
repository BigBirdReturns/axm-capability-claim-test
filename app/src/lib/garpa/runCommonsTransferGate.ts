import type {
  ArchitecturePattern,
  CapabilityPrimitive,
  ComponentObservation,
  ExecutionClass,
} from "../../types/garpaCommons";
import type {
  CommonsCatalogObjectType,
  CommonsCatalogRevision,
} from "../../types/garpaCommonsCatalog";
import type {
  CommonsEnvironmentComparison,
  CommonsExecutionComparison,
  CommonsNominationDisposition,
  CommonsTransferFinding,
  CommonsTransferFindingState,
  CommonsTransferNomination,
  CommonsTransferRequest,
  CommonsTransferResult,
  CommonsTransferredNomination,
  CommonsTransferUse,
} from "../../types/garpaCommonsTransfer";
import { canonicalStringify } from "./canonicalJson";
import {
  buildCommonsRetrievalPlan,
  COMMONS_TRANSFER_PROHIBITED_TRANSITIONS,
  retrievalPlanMatches,
} from "./buildCommonsRetrievalPlan";
import {
  computeCapabilityGraphDigest,
  computeGraphAdmissionReceiptDigest,
} from "./commonsCaseTransferDigest";
import {
  findCatalogEntry,
  validateCommonsCatalog,
} from "./validateCommonsCatalog";
import { validateCapabilityGraph } from "./validateCapabilityGraph";

const EXECUTION_RANK: Record<ExecutionClass, number> = {
  E0_analysis_only: 0,
  E1_simulation_or_replay: 1,
  E2_bench_passive: 2,
  E3_controlled_field_inert: 3,
  E4_regulated_active: 4,
  E5_operational_environment: 5,
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim())));
}

function addFinding(
  findings: CommonsTransferFinding[],
  state: CommonsTransferFindingState,
  reason: string,
  requiredAction: string,
  nomination?: CommonsTransferNomination,
): void {
  findings.push({
    state,
    nominationId: nomination?.nominationId,
    objectType: nomination?.objectType,
    catalogObjectId: nomination?.catalogObjectId,
    reason,
    requiredAction,
  });
}

function globalBlock(
  request: CommonsTransferRequest,
  findings: CommonsTransferFinding[],
): CommonsTransferResult {
  return {
    passed: false,
    state: "transfer_blocked",
    admittedNominationIds: [],
    candidateInputNominationIds: [],
    researchLeadNominationIds: [],
    blockedNominationIds: request.nominations.map((item) => item.nominationId),
    findings,
    nominations: [],
    pullList: unique(findings.map((finding) => finding.requiredAction)),
    prohibitedTransitions: [...COMMONS_TRANSFER_PROHIBITED_TRANSITIONS],
  };
}

function expectedUse(objectType: CommonsCatalogObjectType): CommonsTransferUse {
  if (objectType === "primitive") return "capability_decomposition_hint";
  if (objectType === "component_observation") return "component_retrieval_lead";
  return "architecture_pattern_hint";
}

function normalizedEnvironment(
  environment: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(environment).sort()) {
    result[key.trim().toLowerCase()] = environment[key]!.trim().toLowerCase();
  }
  return result;
}

function compareEnvironment(
  source: Record<string, string> | undefined,
  target: Record<string, string>,
): CommonsEnvironmentComparison {
  if (!source || Object.keys(source).length === 0 || Object.keys(target).length === 0) {
    return "unknown";
  }
  const left = normalizedEnvironment(source);
  const right = normalizedEnvironment(target);
  if (canonicalStringify(left) === canonicalStringify(right)) return "same";
  const overlap = Object.entries(left).filter(
    ([key, value]) => right[key] === value,
  ).length;
  return overlap > 0 ? "partial_overlap" : "different";
}

function strongestExecutionClass(
  objectType: CommonsCatalogObjectType,
  value: CapabilityPrimitive | ComponentObservation | ArchitecturePattern,
): ExecutionClass | undefined {
  if (objectType === "component_observation") {
    return (value as ComponentObservation).executionClass;
  }
  const refs = objectType === "primitive"
    ? (value as CapabilityPrimitive).qualificationRefs
    : (value as ArchitecturePattern).qualificationRefs;
  return refs.reduce<ExecutionClass | undefined>((strongest, ref) => {
    if (!strongest || EXECUTION_RANK[ref.executionClass] > EXECUTION_RANK[strongest]) {
      return ref.executionClass;
    }
    return strongest;
  }, undefined);
}

function compareExecution(
  source: ExecutionClass | undefined,
  target: ExecutionClass | undefined,
): CommonsExecutionComparison {
  if (!source || !target) return "unknown";
  return EXECUTION_RANK[source] >= EXECUTION_RANK[target]
    ? "source_same_or_stronger"
    : "target_more_demanding";
}

function sourceResiduals(
  objectType: CommonsCatalogObjectType,
  value: CapabilityPrimitive | ComponentObservation | ArchitecturePattern,
): string[] {
  return objectType === "primitive"
    ? (value as CapabilityPrimitive).residuals
    : objectType === "component_observation"
      ? (value as ComponentObservation).residuals
      : (value as ArchitecturePattern).residuals;
}

function sourceLimitations(
  objectType: CommonsCatalogObjectType,
  value: CapabilityPrimitive | ComponentObservation | ArchitecturePattern,
): string[] {
  if (objectType === "component_observation") {
    return (value as ComponentObservation).limitations;
  }
  const refs = objectType === "primitive"
    ? (value as CapabilityPrimitive).qualificationRefs
    : (value as ArchitecturePattern).qualificationRefs;
  return unique(refs.flatMap((ref) => ref.limitations));
}

function sourceFalsificationConditions(
  objectType: CommonsCatalogObjectType,
  value: CapabilityPrimitive | ComponentObservation | ArchitecturePattern,
): string[] {
  return objectType === "primitive"
    ? (value as CapabilityPrimitive).falsificationConditions
    : [];
}

function sourceFailureModes(
  objectType: CommonsCatalogObjectType,
  value: CapabilityPrimitive | ComponentObservation | ArchitecturePattern,
): string[] {
  return objectType === "architecture_pattern"
    ? (value as ArchitecturePattern).failureModes
    : [];
}

function sourceEnvironment(
  objectType: CommonsCatalogObjectType,
  value: CapabilityPrimitive | ComponentObservation | ArchitecturePattern,
): Record<string, string> | undefined {
  return objectType === "component_observation"
    ? (value as ComponentObservation).environment
    : undefined;
}

function missingAcknowledgements(
  source: string[],
  acknowledged: string[],
): string[] {
  const values = new Set(acknowledged);
  return source.filter((item) => !values.has(item));
}

function revisionFor(
  request: CommonsTransferRequest,
  nomination: CommonsTransferNomination,
): CommonsCatalogRevision<
  CapabilityPrimitive | ComponentObservation | ArchitecturePattern
> | undefined {
  const entry = findCatalogEntry(
    request.catalog,
    nomination.objectType,
    nomination.catalogObjectId,
  );
  return entry?.revisions.find(
    (revision) => revision.revisionId === nomination.revisionId,
  );
}

function candidateInputAllowed(
  nomination: CommonsTransferNomination,
  revision: CommonsCatalogRevision<
    CapabilityPrimitive | ComponentObservation | ArchitecturePattern
  >,
  environment: CommonsEnvironmentComparison,
  execution: CommonsExecutionComparison,
): boolean {
  if (nomination.objectType !== "component_observation") return false;
  const observation = revision.value as ComponentObservation;
  return (
    revision.state === "current" &&
    observation.state === "locally_qualified" &&
    environment === "same" &&
    execution === "source_same_or_stronger" &&
    nomination.knownMismatches.length === 0 &&
    nomination.requiredEvidencePulls.length > 0 &&
    nomination.requiredQualificationTests.length > 0
  );
}

function transferRecord(
  nomination: CommonsTransferNomination,
  revision: CommonsCatalogRevision<
    CapabilityPrimitive | ComponentObservation | ArchitecturePattern
  >,
  environmentComparison: CommonsEnvironmentComparison,
  executionComparison: CommonsExecutionComparison,
  disposition: CommonsNominationDisposition,
): CommonsTransferredNomination {
  const residuals = sourceResiduals(nomination.objectType, revision.value);
  const limitations = sourceLimitations(nomination.objectType, revision.value);
  const falsificationConditions = sourceFalsificationConditions(
    nomination.objectType,
    revision.value,
  );
  const failureModes = sourceFailureModes(nomination.objectType, revision.value);
  return {
    nominationId: nomination.nominationId,
    disposition,
    requestedUse: nomination.requestedUse,
    targetFunctionIds: [...nomination.targetFunctionIds],
    targetInterfaceIds: [...nomination.targetInterfaceIds],
    source: {
      objectType: nomination.objectType,
      catalogObjectId: nomination.catalogObjectId,
      revisionId: revision.revisionId,
      revisionNumber: revision.revisionNumber,
      revisionState: revision.state,
      objectDigest: revision.objectDigest,
      sourceCaseId: revision.sourceCaseId,
      sourceReleaseId: revision.sourceReleaseId,
      sourceReleaseDigest: revision.sourceReleaseDigest,
      executionClass: strongestExecutionClass(nomination.objectType, revision.value),
      environment: sourceEnvironment(nomination.objectType, revision.value),
      residuals,
      limitations,
      falsificationConditions,
      failureModes,
      value: revision.value,
    },
    environmentComparison,
    executionComparison,
    knownMismatches: [...nomination.knownMismatches],
    requiredEvidencePulls: [...nomination.requiredEvidencePulls],
    requiredQualificationTests: [...nomination.requiredQualificationTests],
  };
}

export function runCommonsTransferGate(
  request: CommonsTransferRequest,
): CommonsTransferResult {
  const globalFindings: CommonsTransferFinding[] = [];
  const catalog = validateCommonsCatalog(request.catalog);
  if (!catalog.ok || !catalog.value) {
    addFinding(
      globalFindings,
      "catalog_invalid",
      `The supplied commons catalog is invalid: ${catalog.errors.join("; ")}`,
      "Repair and revalidate the content-addressed catalog before transfer.",
    );
  }
  const graph = validateCapabilityGraph(request.targetCapabilityGraph);
  if (!graph.ok || !graph.value) {
    addFinding(
      globalFindings,
      "capability_graph_invalid",
      `The target capability graph is invalid: ${graph.errors.join("; ")}`,
      "Repair and revalidate the target capability graph before commons retrieval.",
    );
  }
  if (catalog.value && request.expectedCatalogDigest !== catalog.value.catalogDigest) {
    addFinding(
      globalFindings,
      "catalog_digest_mismatch",
      "The expected commons catalog digest is stale.",
      "Rebuild the transfer request against the current catalog digest.",
    );
  }
  if (
    graph.value &&
    computeCapabilityGraphDigest(graph.value) !== request.targetCapabilityGraphDigest
  ) {
    addFinding(
      globalFindings,
      "graph_digest_mismatch",
      "The target capability graph digest does not match its canonical content.",
      "Recompute the graph digest and obtain a current graph-admission receipt.",
    );
  }

  const receipt = request.targetGraphAdmissionReceipt;
  const receiptDigest = computeGraphAdmissionReceiptDigest({
    receiptId: receipt.receiptId,
    capabilityGraphDigest: receipt.capabilityGraphDigest,
    passed: receipt.passed,
    state: receipt.state,
  });
  if (
    receipt.receiptDigest !== receiptDigest ||
    receipt.capabilityGraphDigest !== request.targetCapabilityGraphDigest
  ) {
    addFinding(
      globalFindings,
      "graph_admission_receipt_invalid",
      "The graph-admission receipt is stale or internally inconsistent.",
      "Supply the canonical admission receipt for the exact target graph digest.",
    );
  }
  if (!receipt.passed || receipt.state !== "admitted_for_substitution") {
    addFinding(
      globalFindings,
      "graph_not_admitted",
      `The target graph gate state is ${receipt.state}.`,
      "Resolve the capability-graph gate before consulting the commons for substitution leads.",
    );
  }

  if (catalog.value && graph.value) {
    const rebuilt = buildCommonsRetrievalPlan({
      catalog: catalog.value,
      expectedCatalogDigest: request.expectedCatalogDigest,
      targetCapabilityGraph: graph.value,
      targetCapabilityGraphDigest: request.targetCapabilityGraphDigest,
      targetGraphAdmissionReceipt: receipt,
    });
    if (
      !rebuilt.passed ||
      !rebuilt.plan ||
      !retrievalPlanMatches(rebuilt.plan, request.retrievalPlan)
    ) {
      addFinding(
        globalFindings,
        "retrieval_plan_mismatch",
        `The retrieval plan is not the deterministic plan for the current catalog and graph.${
          rebuilt.errors.length ? ` ${rebuilt.errors.join("; ")}` : ""
        }`,
        "Rebuild the retrieval plan from the current catalog, graph, and admission receipt.",
      );
    }
  }

  if (globalFindings.length > 0 || !catalog.value || !graph.value) {
    return globalBlock(request, globalFindings);
  }

  const findings: CommonsTransferFinding[] = [];
  const transferred: CommonsTransferredNomination[] = [];
  const blocked = new Set<string>();
  const tasks = new Map(
    request.retrievalPlan.tasks.map((task) => [task.taskId, task]),
  );
  const functions = new Map(
    request.targetCapabilityGraph.functions.map((fn) => [fn.id, fn]),
  );
  const interfaces = new Map(
    request.targetCapabilityGraph.interfaces.map((edge) => [edge.id, edge]),
  );

  for (const nomination of request.nominations) {
    const start = findings.length;
    const revision = revisionFor(request, nomination);
    if (!revision) {
      addFinding(
        findings,
        "catalog_revision_missing",
        "The nominated catalog revision does not exist under the nominated object identity.",
        "Select an exact revision returned by the content-addressed catalog search.",
        nomination,
      );
      blocked.add(nomination.nominationId);
      continue;
    }
    if (revision.objectDigest !== nomination.objectDigest) {
      addFinding(
        findings,
        "object_digest_mismatch",
        "The nominated object digest does not match the stored catalog revision.",
        "Bind the nomination to the exact revision digest returned by the catalog.",
        nomination,
      );
    }
    if (revision.state === "withdrawn") {
      addFinding(
        findings,
        "withdrawn_revision",
        "Withdrawn commons revisions cannot seed a target case.",
        "Use a current revision or recover the evidence needed to create a new admitted revision.",
        nomination,
      );
    } else if (
      revision.state === "superseded" &&
      !request.allowHistoricalResearch
    ) {
      addFinding(
        findings,
        "historical_revision_not_permitted",
        "The nomination references a superseded revision while historical research is disabled.",
        "Use the current revision or explicitly permit historical research without candidate-input status.",
        nomination,
      );
    }
    if (nomination.requestedUse !== expectedUse(nomination.objectType)) {
      addFinding(
        findings,
        "transfer_use_mismatch",
        `Object type ${nomination.objectType} cannot be used as ${nomination.requestedUse}.`,
        `Use ${expectedUse(nomination.objectType)} for this object class.`,
        nomination,
      );
    }

    const referencedTasks = nomination.retrievalTaskIds.flatMap((id) => {
      const task = tasks.get(id);
      return task ? [task] : [];
    });
    if (referencedTasks.length !== nomination.retrievalTaskIds.length) {
      addFinding(
        findings,
        "retrieval_task_mismatch",
        "The nomination references a task absent from the deterministic retrieval plan.",
        "Reference only task identifiers from the current retrieval plan.",
        nomination,
      );
    }
    for (const functionId of nomination.targetFunctionIds) {
      if (
        !referencedTasks.some(
          (task) => task.targetKind === "function" && task.targetId === functionId,
        )
      ) {
        addFinding(
          findings,
          "retrieval_task_mismatch",
          `Target function ${functionId} is not covered by a referenced retrieval task.`,
          "Attach the deterministic function retrieval task to the nomination.",
          nomination,
        );
      }
      const fn = functions.get(functionId);
      if (
        !fn ||
        fn.state !== "required" ||
        fn.functionClass === "vendor_specific"
      ) {
        addFinding(
          findings,
          "target_function_invalid",
          `Target function ${functionId} is absent, non-required, or vendor-specific.`,
          "Map commons objects only to required implementation-neutral functions in the admitted graph.",
          nomination,
        );
      }
    }
    if (
      (nomination.objectType === "component_observation" ||
        nomination.objectType === "architecture_pattern") &&
      nomination.targetInterfaceIds.length === 0
    ) {
      addFinding(
        findings,
        "target_mapping_invalid",
        "Component and architecture-pattern nominations require target interface mappings.",
        "Map the source object to the exact target interfaces it could inform.",
        nomination,
      );
    }
    const targetFunctionSet = new Set(nomination.targetFunctionIds);
    for (const interfaceId of nomination.targetInterfaceIds) {
      if (
        !referencedTasks.some(
          (task) => task.targetKind === "interface" && task.targetId === interfaceId,
        )
      ) {
        addFinding(
          findings,
          "retrieval_task_mismatch",
          `Target interface ${interfaceId} is not covered by a referenced retrieval task.`,
          "Attach the deterministic interface retrieval task to the nomination.",
          nomination,
        );
      }
      const edge = interfaces.get(interfaceId);
      if (!edge) {
        addFinding(
          findings,
          "target_interface_invalid",
          `Target interface ${interfaceId} does not exist in the admitted graph.`,
          "Use an exact interface identifier from the target capability graph.",
          nomination,
        );
      } else if (
        ![...edge.producerFunctionIds, ...edge.consumerFunctionIds].some((id) =>
          targetFunctionSet.has(id),
        )
      ) {
        addFinding(
          findings,
          "target_mapping_invalid",
          `Target interface ${interfaceId} is not connected to any mapped target function.`,
          "Map interfaces only where they connect to the nominated target functions.",
          nomination,
        );
      }
    }

    const residuals = sourceResiduals(nomination.objectType, revision.value);
    const limitations = sourceLimitations(nomination.objectType, revision.value);
    const falsification = sourceFalsificationConditions(
      nomination.objectType,
      revision.value,
    );
    const failureModes = sourceFailureModes(nomination.objectType, revision.value);
    const missingResiduals = missingAcknowledgements(
      residuals,
      nomination.acknowledgedResiduals,
    );
    if (missingResiduals.length > 0) {
      addFinding(
        findings,
        "residual_acknowledgement_incomplete",
        `The nomination omits source residuals: ${missingResiduals.join(" | ")}`,
        "Carry every source residual verbatim into the target-case nomination.",
        nomination,
      );
    }
    const missingLimitations = missingAcknowledgements(
      limitations,
      nomination.acknowledgedLimitations,
    );
    if (missingLimitations.length > 0) {
      addFinding(
        findings,
        "limitation_acknowledgement_incomplete",
        `The nomination omits source limitations: ${missingLimitations.join(" | ")}`,
        "Carry every source limitation verbatim into the target-case nomination.",
        nomination,
      );
    }
    const missingFalsification = missingAcknowledgements(
      falsification,
      nomination.acknowledgedFalsificationConditions,
    );
    if (missingFalsification.length > 0) {
      addFinding(
        findings,
        "falsification_acknowledgement_incomplete",
        `The nomination omits source falsification conditions: ${missingFalsification.join(" | ")}`,
        "Carry every source falsification condition into the target case.",
        nomination,
      );
    }
    const missingFailures = missingAcknowledgements(
      failureModes,
      nomination.acknowledgedFailureModes,
    );
    if (missingFailures.length > 0) {
      addFinding(
        findings,
        "failure_mode_acknowledgement_incomplete",
        `The nomination omits source failure modes: ${missingFailures.join(" | ")}`,
        "Carry every architecture-pattern failure mode into the target case.",
        nomination,
      );
    }

    const environment = compareEnvironment(
      sourceEnvironment(nomination.objectType, revision.value),
      request.targetEnvironment,
    );
    if (environment !== nomination.declaredEnvironmentComparison) {
      addFinding(
        findings,
        "environment_comparison_mismatch",
        `Declared environment comparison ${nomination.declaredEnvironmentComparison} differs from computed state ${environment}.`,
        "Recompute the source-to-target environment comparison from exact records.",
        nomination,
      );
    }
    const sourceExecution = strongestExecutionClass(
      nomination.objectType,
      revision.value,
    );
    const execution = compareExecution(
      sourceExecution,
      request.targetExecutionClass,
    );
    if (execution !== nomination.declaredExecutionComparison) {
      addFinding(
        findings,
        "execution_comparison_mismatch",
        `Declared execution comparison ${nomination.declaredExecutionComparison} differs from computed state ${execution}.`,
        "Recompute execution-class transfer against the target case requirement.",
        nomination,
      );
    }
    if (
      (environment !== "same" ||
        execution === "target_more_demanding" ||
        execution === "unknown") &&
      nomination.knownMismatches.length === 0
    ) {
      addFinding(
        findings,
        "transfer_scope_mismatch",
        "The target context is broader, different, or unresolved, but the nomination declares no mismatch.",
        "Record the environmental, execution, interface, operator, or mission mismatches explicitly.",
        nomination,
      );
    }
    if (nomination.requiredEvidencePulls.length === 0) {
      addFinding(
        findings,
        "requalification_plan_missing",
        "Every transferred object requires target-case evidence pulls.",
        "Name the evidence required before this nomination can become a target-case candidate.",
        nomination,
      );
    }
    if (
      (nomination.objectType === "component_observation" ||
        nomination.objectType === "architecture_pattern") &&
      nomination.requiredQualificationTests.length === 0
    ) {
      addFinding(
        findings,
        "requalification_plan_missing",
        "Component and architecture-pattern nominations require target-case qualification tests.",
        "Name the tests that could disprove transfer under the target fixture and environment.",
        nomination,
      );
    }

    if (findings.length > start) {
      blocked.add(nomination.nominationId);
      continue;
    }
    const disposition: CommonsNominationDisposition =
      candidateInputAllowed(nomination, revision, environment, execution) &&
      revision.state === "current"
        ? "candidate_input"
        : "research_lead";
    transferred.push(
      transferRecord(
        nomination,
        revision,
        environment,
        execution,
        disposition,
      ),
    );
  }

  const admittedNominationIds = transferred.map((item) => item.nominationId);
  const candidateInputNominationIds = transferred
    .filter((item) => item.disposition === "candidate_input")
    .map((item) => item.nominationId);
  const researchLeadNominationIds = transferred
    .filter((item) => item.disposition === "research_lead")
    .map((item) => item.nominationId);
  const blockedNominationIds = [...blocked];
  const passed = findings.length === 0;
  const state = passed
    ? "transfer_admitted"
    : transferred.length > 0
      ? "transfer_partially_admitted"
      : "transfer_blocked";

  return {
    passed,
    state,
    admittedNominationIds,
    candidateInputNominationIds,
    researchLeadNominationIds,
    blockedNominationIds,
    findings,
    nominations: transferred,
    pullList: unique([
      ...request.nominations.flatMap((item) => item.requiredEvidencePulls),
      ...request.nominations.flatMap((item) => item.requiredQualificationTests),
      ...findings.map((finding) => finding.requiredAction),
    ]),
    prohibitedTransitions: [...COMMONS_TRANSFER_PROHIBITED_TRANSITIONS],
  };
}
