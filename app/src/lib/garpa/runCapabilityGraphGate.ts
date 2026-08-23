import type { GarpaAdmissionResult, MissionOutcome } from "../../types/garpa";
import type {
  CapabilityFunction,
  CapabilityGraph,
  CapabilityGraphGateResult,
  ConstraintEnvelope,
  MissionTraceField,
} from "../../types/garpaCapability";

const REQUIRED_MISSION_FIELDS: MissionTraceField[] = [
  "operator",
  "protected_or_affected_object",
  "problem_or_threat",
  "desired_state_change",
  "operating_environment",
  "time_and_coverage_requirement",
];

function activeFunctions(graph: CapabilityGraph): CapabilityFunction[] {
  return graph.functions.filter((fn) => fn.state !== "excluded");
}

function dependencyCycles(graph: CapabilityGraph): string[] {
  const functions = activeFunctions(graph);
  const activeIds = new Set(functions.map((fn) => fn.id));
  const adjacency = new Map(
    functions.map((fn) => [
      fn.id,
      fn.functionDependencyIds.filter((id) => activeIds.has(id)),
    ]),
  );

  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const cycles: string[][] = [];

  function strongConnect(id: string): void {
    indices.set(id, index);
    lowLinks.set(id, index);
    index += 1;
    stack.push(id);
    onStack.add(id);

    for (const next of adjacency.get(id) ?? []) {
      if (!indices.has(next)) {
        strongConnect(next);
        lowLinks.set(id, Math.min(lowLinks.get(id)!, lowLinks.get(next)!));
      } else if (onStack.has(next)) {
        lowLinks.set(id, Math.min(lowLinks.get(id)!, indices.get(next)!));
      }
    }

    if (lowLinks.get(id) !== indices.get(id)) return;
    const component: string[] = [];
    while (stack.length > 0) {
      const member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
      if (member === id) break;
    }
    const selfLoop =
      component.length === 1 &&
      (adjacency.get(component[0]!) ?? []).includes(component[0]!);
    if (component.length > 1 || selfLoop) cycles.push(component.sort());
  }

  for (const fn of functions) {
    if (!indices.has(fn.id)) strongConnect(fn.id);
  }

  return cycles
    .filter(
      (cycle) =>
        !graph.feedbackLoops.some((loop) =>
          cycle.every((functionId) => loop.functionIds.includes(functionId)),
        ),
    )
    .map((cycle) => cycle.join(" -> "));
}

function incompleteConstraintSections(
  envelope: ConstraintEnvelope,
): Array<keyof ConstraintEnvelope> {
  return (Object.keys(envelope) as Array<keyof ConstraintEnvelope>).filter((key) => {
    const section = envelope[key];
    return (
      section.state !== "complete" ||
      section.statements.length === 0 ||
      section.openQuestions.length > 0
    );
  });
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function buildPullList(result: Omit<CapabilityGraphGateResult, "pullList">): string[] {
  const pulls: string[] = [];
  if (result.state === "admission_not_passed") {
    pulls.push("Pass the GARPA offering and goal admission gates before capability decomposition.");
  }
  if (result.state === "mission_digest_mismatch") {
    pulls.push("Regenerate or explicitly migrate the graph against the current mission-outcome digest.");
  }
  for (const field of result.uncoveredMissionFields) {
    pulls.push(`Trace the admitted mission field ${field} to one or more required functions.`);
  }
  for (const metricId of result.uncoveredMetricIds) {
    pulls.push(`Trace admitted success metric ${metricId} to the functions that produce and measure it.`);
  }
  for (const functionId of result.orphanEssentialFunctionIds) {
    pulls.push(`Either trace essential function ${functionId} to the mission or remove its essential classification.`);
  }
  for (const functionId of result.unresolvedFunctionIds) {
    pulls.push(`Resolve function ${functionId} before substitution planning.`);
  }
  for (const interfaceId of result.danglingInterfaceIds) {
    pulls.push(`Resolve the producer, consumer, external endpoint, or terminal state for interface ${interfaceId}.`);
  }
  for (const dependencyId of result.unresolvedDependencyIds) {
    pulls.push(`Resolve referenced dependency ${dependencyId}.`);
  }
  for (const cycle of result.undeclaredDependencyCycles) {
    pulls.push(`Break dependency cycle ${cycle} or declare it as an intentional feedback loop.`);
  }
  for (const functionId of result.missingHumanRoleFunctionIds) {
    pulls.push(`Assign a human role to function ${functionId} and state its workload and responsibility.`);
  }
  for (const section of result.incompleteConstraintSections) {
    pulls.push(`Close the ${section} constraint section or preserve the graph as blocked.`);
  }
  for (const functionId of result.missingAuthorityFunctionIds) {
    pulls.push(`Define the authorization and abort boundary for safety-critical function ${functionId}.`);
  }
  for (const functionId of result.vendorLeakageFunctionIds) {
    pulls.push(`Replace required vendor-specific function ${functionId} with its implementation-neutral purpose.`);
  }
  return unique(pulls);
}

export function runCapabilityGraphGate(
  graph: CapabilityGraph,
  missionOutcome: MissionOutcome,
  admission: GarpaAdmissionResult,
  currentMissionOutcomeDigest: string,
): CapabilityGraphGateResult {
  if (!admission.passed) {
    const blocked: CapabilityGraphGateResult = {
      state: "admission_not_passed",
      passed: false,
      admissionState: admission.state,
      uncoveredMissionFields: [],
      uncoveredMetricIds: [],
      orphanEssentialFunctionIds: [],
      unresolvedFunctionIds: [],
      danglingInterfaceIds: [],
      unresolvedDependencyIds: [],
      undeclaredDependencyCycles: [],
      missingHumanRoleFunctionIds: [],
      incompleteConstraintSections: [],
      missingAuthorityFunctionIds: [],
      vendorLeakageFunctionIds: [],
      pullList: [
        "Pass the GARPA offering and goal admission gates before capability decomposition.",
      ],
    };
    return blocked;
  }
  if (graph.missionOutcomeDigest !== currentMissionOutcomeDigest) {
    const blocked: CapabilityGraphGateResult = {
      state: "mission_digest_mismatch",
      passed: false,
      admissionState: admission.state,
      uncoveredMissionFields: [],
      uncoveredMetricIds: [],
      orphanEssentialFunctionIds: [],
      unresolvedFunctionIds: [],
      danglingInterfaceIds: [],
      unresolvedDependencyIds: [],
      undeclaredDependencyCycles: [],
      missingHumanRoleFunctionIds: [],
      incompleteConstraintSections: [],
      missingAuthorityFunctionIds: [],
      vendorLeakageFunctionIds: [],
      pullList: [
        "Regenerate or explicitly migrate the graph against the current mission-outcome digest.",
      ],
    };
    return blocked;
  }

  const active = activeFunctions(graph);
  const requiredFunctionIds = new Set(
    active.filter((fn) => fn.state === "required").map((fn) => fn.id),
  );
  const functionById = new Map(graph.functions.map((fn) => [fn.id, fn]));
  const externalDependencyById = new Map(
    graph.externalDependencies.map((dependency) => [dependency.id, dependency]),
  );
  const externalDependencyIds = new Set(
    graph.externalDependencies.map((dependency) => dependency.id),
  );
  const humanRoleIds = new Set(graph.humanRoles.map((role) => role.id));
  const interfaceIds = new Set(graph.interfaces.map((interf) => interf.id));

  const requiredMetricIds = missionOutcome.successMetrics
    .map((metric) => metric.id)
    .filter((metricId) => !admission.goalGate.rejectedMetricIds.includes(metricId));

  const uncoveredMissionFields = REQUIRED_MISSION_FIELDS.filter(
    (field) =>
      !graph.traces.some(
        (trace) =>
          trace.missionField === field &&
          trace.functionIds.some((id) => requiredFunctionIds.has(id)),
      ),
  );
  const uncoveredMetricIds = requiredMetricIds.filter(
    (metricId) =>
      !graph.traces.some(
        (trace) =>
          trace.missionField === "success_metric" &&
          trace.metricId === metricId &&
          trace.functionIds.some((id) => requiredFunctionIds.has(id)),
      ),
  );

  const tracedFunctionIds = new Set(graph.traces.flatMap((trace) => trace.functionIds));
  const orphanEssentialFunctionIds = active
    .filter(
      (fn) =>
        fn.state === "required" &&
        fn.functionClass === "essential" &&
        !tracedFunctionIds.has(fn.id),
    )
    .map((fn) => fn.id);
  const unresolvedFunctionIds = active
    .filter((fn) => fn.state === "unresolved")
    .map((fn) => fn.id);

  const unresolvedDependencyIds: string[] = [];
  for (const fn of active) {
    for (const id of fn.functionDependencyIds) {
      const dependency = functionById.get(id);
      if (!dependency || dependency.state === "excluded") {
        unresolvedDependencyIds.push(id);
      } else if (fn.state === "required" && dependency.state !== "required") {
        unresolvedDependencyIds.push(id);
      }
    }
    for (const id of fn.externalDependencyIds) {
      const dependency = externalDependencyById.get(id);
      if (!dependency || (fn.state === "required" && !dependency.required)) {
        unresolvedDependencyIds.push(id);
      }
    }
    for (const id of [...fn.inputInterfaceIds, ...fn.outputInterfaceIds]) {
      if (!interfaceIds.has(id)) unresolvedDependencyIds.push(id);
    }
    for (const id of fn.humanRoleIds) {
      if (!humanRoleIds.has(id)) unresolvedDependencyIds.push(id);
    }
  }

  const producers = new Map<string, string[]>();
  const consumers = new Map<string, string[]>();
  for (const fn of active) {
    for (const id of fn.outputInterfaceIds) {
      producers.set(id, [...(producers.get(id) ?? []), fn.id]);
    }
    for (const id of fn.inputInterfaceIds) {
      consumers.set(id, [...(consumers.get(id) ?? []), fn.id]);
    }
  }

  const danglingInterfaceIds = graph.interfaces
    .filter((interf) => {
      const hasProducer =
        (producers.get(interf.id)?.length ?? 0) > 0 ||
        interf.externalProducerDependencyIds.some((id) => externalDependencyIds.has(id));
      const hasConsumer =
        (consumers.get(interf.id)?.length ?? 0) > 0 ||
        interf.externalConsumerDependencyIds.some((id) => externalDependencyIds.has(id)) ||
        interf.terminal;
      return !hasProducer || !hasConsumer;
    })
    .map((interf) => interf.id);

  for (const interf of graph.interfaces) {
    for (const id of [
      ...interf.externalProducerDependencyIds,
      ...interf.externalConsumerDependencyIds,
    ]) {
      if (!externalDependencyIds.has(id)) unresolvedDependencyIds.push(id);
    }
  }

  const undeclaredDependencyCycles = dependencyCycles(graph);
  const missingHumanRoleFunctionIds = active
    .filter(
      (fn) =>
        fn.state === "required" &&
        (["manual", "decision_support", "supervised_automation"].includes(
          fn.automationLevel,
        ) || fn.consequenceClass === "safety_critical") &&
        fn.humanRoleIds.length === 0,
    )
    .map((fn) => fn.id);
  const incompleteSections = incompleteConstraintSections(graph.constraintEnvelope);
  const missingAuthorityFunctionIds = active
    .filter(
      (fn) =>
        fn.state === "required" &&
        fn.consequenceClass === "safety_critical" &&
        !fn.authorityBoundary?.trim(),
    )
    .map((fn) => fn.id);
  const vendorLeakageFunctionIds = active
    .filter(
      (fn) => fn.state === "required" && fn.functionClass === "vendor_specific",
    )
    .map((fn) => fn.id);

  const state = uncoveredMissionFields.length > 0 || uncoveredMetricIds.length > 0
    ? "mission_trace_incomplete"
    : orphanEssentialFunctionIds.length > 0 || unresolvedFunctionIds.length > 0
      ? "essential_function_unresolved"
      : danglingInterfaceIds.length > 0 ||
          unresolvedDependencyIds.length > 0 ||
          undeclaredDependencyCycles.length > 0
        ? "interface_graph_incomplete"
        : missingHumanRoleFunctionIds.length > 0
          ? "human_role_missing"
          : incompleteSections.length > 0
            ? "constraint_envelope_incomplete"
            : missingAuthorityFunctionIds.length > 0
              ? "authorization_boundary_missing"
              : vendorLeakageFunctionIds.length > 0
                ? "vendor_architecture_leakage"
                : "admitted_for_substitution";

  const base: Omit<CapabilityGraphGateResult, "pullList"> = {
    state,
    passed: state === "admitted_for_substitution",
    admissionState: admission.state,
    uncoveredMissionFields,
    uncoveredMetricIds,
    orphanEssentialFunctionIds,
    unresolvedFunctionIds,
    danglingInterfaceIds,
    unresolvedDependencyIds: unique(unresolvedDependencyIds),
    undeclaredDependencyCycles,
    missingHumanRoleFunctionIds,
    incompleteConstraintSections: incompleteSections,
    missingAuthorityFunctionIds,
    vendorLeakageFunctionIds,
  };

  return { ...base, pullList: buildPullList(base) };
}
