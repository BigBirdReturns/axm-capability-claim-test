import type {
  ClaimPacket,
  EvidenceCell,
  EvidenceControl,
  EvidenceTarget,
} from "../../types/garpa";
import type {
  CapabilityGraph,
  CapabilityGraphGateResult,
} from "../../types/garpaCapability";
import type {
  ComponentCandidate,
  ComponentCompatibilityEdge,
  SubstitutionGateResult,
  SubstitutionPlan,
} from "../../types/garpaSubstitution";

const EXTERNAL_CONTROLS = new Set<EvidenceControl>([
  "externally_attributed",
  "independent",
  "local_measured",
]);

const REPRODUCED_CONTROLS = new Set<EvidenceControl>([
  "independent",
  "local_measured",
]);

const SOFTWARE_KINDS = new Set([
  "software_package",
  "open_source_project",
  "service",
  "custom_code",
]);

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function cellsFor(
  ids: string[],
  cells: ReadonlyMap<string, EvidenceCell>,
): EvidenceCell[] {
  return ids.flatMap((id) => {
    const cell = cells.get(id);
    return cell ? [cell] : [];
  });
}

function hasEvidence(
  ids: string[],
  cells: ReadonlyMap<string, EvidenceCell>,
  target: EvidenceTarget,
  controls?: ReadonlySet<EvidenceControl>,
  subjectVersion?: string,
): boolean {
  return cellsFor(ids, cells).some(
    (cell) =>
      cell.target === target &&
      (!controls || controls.has(cell.control)) &&
      (!subjectVersion || cell.subjectVersion?.trim() === subjectVersion.trim()),
  );
}

function componentIdentityAdmitted(
  component: ComponentCandidate,
  cells: ReadonlyMap<string, EvidenceCell>,
): boolean {
  if (!component.product.trim() || !component.exactModelOrVersion.trim()) return false;
  if (["unverified", "superseded"].includes(component.lifecycle)) return false;
  if (
    !hasEvidence(
      component.identityEvidenceCellIds,
      cells,
      "component_identity",
      undefined,
      component.exactModelOrVersion,
    )
  ) {
    return false;
  }
  if (SOFTWARE_KINDS.has(component.kind)) {
    if (!component.license?.trim()) return false;
    if (
      !hasEvidence(
        component.licenseEvidenceCellIds,
        cells,
        "component_license",
        undefined,
        component.exactModelOrVersion,
      )
    ) {
      return false;
    }
  }
  return true;
}

function componentPerformanceAdmitted(
  component: ComponentCandidate,
  cells: ReadonlyMap<string, EvidenceCell>,
): boolean {
  if (["vendor_claimed", "community_reported"].includes(component.maturity)) {
    return false;
  }
  const controls = component.maturity === "independently_reported"
    ? EXTERNAL_CONTROLS
    : REPRODUCED_CONTROLS;
  return hasEvidence(
    component.performanceEvidenceCellIds,
    cells,
    "component_performance",
    controls,
    component.exactModelOrVersion,
  );
}

function componentAvailable(
  component: ComponentCandidate,
  cells: ReadonlyMap<string, EvidenceCell>,
): boolean {
  if (component.lifecycle === "end_of_life") return false;
  if (!component.availability) return false;
  if (["unavailable", "unknown"].includes(component.availability.state)) return false;
  return hasEvidence(
    component.availability.evidenceCellIds,
    cells,
    "component_availability",
    EXTERNAL_CONTROLS,
    component.exactModelOrVersion,
  );
}

function componentPriceAdmitted(
  component: ComponentCandidate,
  cells: ReadonlyMap<string, EvidenceCell>,
): boolean {
  if (!component.price) return false;
  return hasEvidence(
    component.price.evidenceCellIds,
    cells,
    "component_price",
    EXTERNAL_CONTROLS,
    component.exactModelOrVersion,
  );
}

function compatibilityAdmitted(
  edge: ComponentCompatibilityEdge,
  graph: CapabilityGraph,
  plan: SubstitutionPlan,
  cells: ReadonlyMap<string, EvidenceCell>,
): boolean {
  if (
    ![
      "confirmed_compatible",
      "reported_compatible",
      "adapter_required",
    ].includes(edge.state)
  ) {
    return false;
  }
  if (!edge.falsificationTest.trim()) return false;
  if (
    !hasEvidence(
      edge.evidenceCellIds,
      cells,
      "component_compatibility",
      EXTERNAL_CONTROLS,
    )
  ) {
    return false;
  }
  if (
    edge.state === "adapter_required" &&
    edge.adapterComponentIds.length === 0 &&
    edge.customCodeIds.length === 0
  ) {
    return false;
  }

  const graphEdge = graph.interfaces.find(
    (candidate) => candidate.id === edge.interfaceId,
  );
  if (!graphEdge) return false;
  const producerFunctions = new Set(graphEdge.producerFunctionIds);
  const consumerFunctions = new Set(graphEdge.consumerFunctionIds);

  const producerCovered = edge.producerComponentIds.some((componentId) => {
    const component = plan.components.find((candidate) => candidate.id === componentId);
    return component?.functionIds.some((id) => producerFunctions.has(id)) ?? false;
  });
  const consumerCovered = edge.consumerComponentIds.some((componentId) => {
    const component = plan.components.find((candidate) => candidate.id === componentId);
    return component?.functionIds.some((id) => consumerFunctions.has(id)) ?? false;
  });
  return producerCovered && consumerCovered;
}

function customCodeUnbounded(plan: SubstitutionPlan): string[] {
  return plan.customCode
    .filter(
      (code) =>
        ["research_grade", "unresolved"].includes(code.complexity) ||
        code.inputs.length === 0 ||
        code.outputs.length === 0 ||
        code.testStrategy.length === 0 ||
        code.residuals.length === 0,
    )
    .map((code) => code.id);
}

function optionIncomplete(plan: SubstitutionPlan): string[] {
  return plan.options
    .filter(
      (option) =>
        !option.composition.trim() ||
        !option.falsificationTest.trim() ||
        option.residuals.length === 0 ||
        option.componentIds.length + option.customCodeIds.length === 0,
    )
    .map((option) => option.id);
}

function costFindings(
  plan: SubstitutionPlan,
  cells: ReadonlyMap<string, EvidenceCell>,
): string[] {
  const findings: string[] = [];
  if (plan.costBoundary.state !== "complete") {
    findings.push("The substitution cost boundary is not complete.");
  }
  if (!plan.costBoundary.currency?.trim()) {
    findings.push("The substitution cost boundary has no currency.");
  }
  if (!plan.costBoundary.evaluationPeriod?.trim()) {
    findings.push("The substitution cost boundary has no evaluation period.");
  }
  for (const category of ["integration_labor", "qualification"]) {
    if (!plan.costBoundary.includedCategories.includes(category)) {
      findings.push(`The cost boundary omits required category ${category}.`);
    }
  }

  const usedComponents = new Set(
    plan.options
      .filter((option) => option.coverage === "complete_candidate")
      .flatMap((option) => option.componentIds),
  );
  for (const componentId of usedComponents) {
    const component = plan.components.find((candidate) => candidate.id === componentId);
    if (component && !componentPriceAdmitted(component, cells)) {
      findings.push(`Component ${componentId} lacks an admitted price observation.`);
    }
  }
  return findings;
}

function buildPullList(result: Omit<SubstitutionGateResult, "pullList">): string[] {
  const pulls: string[] = [];
  if (result.state === "capability_graph_not_admitted") {
    pulls.push("Pass the capability-graph gate before selecting components.");
  }
  if (result.state === "graph_digest_mismatch") {
    pulls.push("Regenerate or migrate the substitution plan against the current capability-graph digest.");
  }
  for (const id of result.invalidComponentIds) {
    pulls.push(`Resolve exact identity, lifecycle, and license evidence for component ${id}.`);
  }
  for (const id of result.weakEvidenceComponentIds) {
    pulls.push(`Obtain external or reproduced performance evidence for component ${id}.`);
  }
  for (const id of result.unavailableComponentIds) {
    pulls.push(`Resolve current availability for component ${id} or select a replacement.`);
  }
  for (const id of result.uncoveredFunctionIds) {
    pulls.push(`Provide a complete, evidence-admissible substitution option for function ${id}.`);
  }
  for (const id of result.uncoveredInterfaceIds) {
    pulls.push(`Provide a compatibility edge and falsification test for interface ${id}.`);
  }
  for (const id of result.incompatibleInterfaceIds) {
    pulls.push(`Resolve or replace the incompatible, experimental, or unknown path for interface ${id}.`);
  }
  for (const id of result.unboundedCustomCodeIds) {
    pulls.push(`Bound custom-code component ${id} with typed inputs, outputs, complexity, tests, and residuals.`);
  }
  for (const id of result.incompleteOptionIds) {
    pulls.push(`Complete substitution option ${id} with a composition, residual, and falsification test.`);
  }
  pulls.push(...result.costBoundaryFindings);
  return dedupe(pulls);
}

export function runSubstitutionGate(
  plan: SubstitutionPlan,
  graph: CapabilityGraph,
  graphGate: CapabilityGraphGateResult,
  expectedCapabilityGraphDigest: string,
  packet: ClaimPacket,
): SubstitutionGateResult {
  const cells = new Map(packet.evidence.map((cell) => [cell.id, cell]));
  const invalidComponentIds = plan.components
    .filter((component) => !componentIdentityAdmitted(component, cells))
    .map((component) => component.id);
  const weakEvidenceComponentIds = plan.components
    .filter((component) => !componentPerformanceAdmitted(component, cells))
    .map((component) => component.id);
  const unavailableComponentIds = plan.components
    .filter((component) => !componentAvailable(component, cells))
    .map((component) => component.id);
  const unboundedCustomCodeIds = customCodeUnbounded(plan);
  const incompleteOptionIds = optionIncomplete(plan);

  const blockedComponents = new Set([
    ...invalidComponentIds,
    ...weakEvidenceComponentIds,
    ...unavailableComponentIds,
  ]);
  const blockedCode = new Set(unboundedCustomCodeIds);
  const incompleteOptions = new Set(incompleteOptionIds);
  const requiredFunctionIds = graph.functions
    .filter((fn) => fn.functionClass === "essential" && fn.state === "required")
    .map((fn) => fn.id);
  const uncoveredFunctionIds = requiredFunctionIds.filter((functionId) =>
    !plan.options.some(
      (option) =>
        option.functionId === functionId &&
        option.coverage === "complete_candidate" &&
        ["established", "reported"].includes(option.maturity) &&
        !incompleteOptions.has(option.id) &&
        option.componentIds.every((id) => !blockedComponents.has(id)) &&
        option.customCodeIds.every((id) => !blockedCode.has(id)),
    ),
  );

  const internalInterfaceIds = graph.interfaces
    .filter(
      (edge) =>
        edge.producerFunctionIds.length > 0 && edge.consumerFunctionIds.length > 0,
    )
    .map((edge) => edge.id);
  const uncoveredInterfaceIds: string[] = [];
  const incompatibleInterfaceIds: string[] = [];
  for (const interfaceId of internalInterfaceIds) {
    const edges = plan.compatibilityEdges.filter(
      (edge) => edge.interfaceId === interfaceId,
    );
    if (edges.length === 0) {
      uncoveredInterfaceIds.push(interfaceId);
      continue;
    }
    if (!edges.some((edge) => compatibilityAdmitted(edge, graph, plan, cells))) {
      incompatibleInterfaceIds.push(interfaceId);
    }
  }

  const costBoundaryFindings = costFindings(plan, cells);
  const state = !graphGate.passed
    ? "capability_graph_not_admitted"
    : plan.capabilityGraphDigest !== expectedCapabilityGraphDigest
      ? "graph_digest_mismatch"
      : invalidComponentIds.length > 0
        ? "component_identity_incomplete"
        : weakEvidenceComponentIds.length > 0 || unavailableComponentIds.length > 0
          ? "component_evidence_insufficient"
          : unboundedCustomCodeIds.length > 0
            ? "custom_code_unbounded"
            : incompleteOptionIds.length > 0
              ? "residual_or_test_missing"
              : uncoveredFunctionIds.length > 0
                ? "function_coverage_incomplete"
                : uncoveredInterfaceIds.length > 0 || incompatibleInterfaceIds.length > 0
                  ? "interface_coverage_incomplete"
                  : costBoundaryFindings.length > 0
                    ? "cost_boundary_incomplete"
                    : "admitted_for_architecture";

  const withoutPulls: Omit<SubstitutionGateResult, "pullList"> = {
    state,
    passed: state === "admitted_for_architecture",
    invalidComponentIds,
    weakEvidenceComponentIds,
    unavailableComponentIds,
    uncoveredFunctionIds,
    uncoveredInterfaceIds,
    incompatibleInterfaceIds,
    unboundedCustomCodeIds,
    incompleteOptionIds,
    costBoundaryFindings,
  };
  return { ...withoutPulls, pullList: buildPullList(withoutPulls) };
}
