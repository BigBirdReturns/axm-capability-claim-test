import type {
  GarpaAdmissionResult,
  MissionOutcome,
} from "../../types/garpa";
import type {
  CapabilityConstraintEnvelope,
  CapabilityFunction,
  CapabilityGraph,
  CapabilityGraphGateResult,
} from "../../types/garpaCapability";

const HUMAN_IN_LOOP_LEVELS = new Set([
  "manual",
  "decision_support",
  "supervised_automation",
]);

const CONSTRAINT_KEYS: Array<keyof CapabilityConstraintEnvelope> = [
  "environment",
  "deployment",
  "resources",
  "governance",
  "economic",
];

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function requiredMissionRequirementKeys(outcome: MissionOutcome): string[] {
  const keys = [
    "operator",
    "protected_or_affected_object",
    "problem_or_threat",
    "desired_state_change",
    "operating_environment",
    "time_and_coverage_requirement",
    ...outcome.successMetrics.map((metric) => `metric:${metric.id}`),
  ];
  if (
    outcome.economicConstraint &&
    outcome.economicConstraint.basis !== "open" &&
    outcome.economicConstraint.basis !== "analyst_hypothesis"
  ) {
    keys.push("economic_constraint");
  }
  return keys;
}

function requiredEssentialFunctions(graph: CapabilityGraph): CapabilityFunction[] {
  return graph.functions.filter(
    (fn) => fn.functionClass === "essential" && fn.state === "required",
  );
}

function interfaceFindings(graph: CapabilityGraph): {
  danglingInterfaceIds: string[];
  mismatches: string[];
} {
  const edges = new Map(graph.interfaces.map((edge) => [edge.id, edge]));
  const functions = new Map(graph.functions.map((fn) => [fn.id, fn]));
  const danglingInterfaceIds: string[] = [];
  const mismatches: string[] = [];

  for (const edge of graph.interfaces) {
    if (edge.producerFunctionIds.length === 0 && !edge.externalSource?.trim()) {
      danglingInterfaceIds.push(edge.id);
    }
    if (edge.consumerFunctionIds.length === 0 && !edge.terminalPurpose?.trim()) {
      danglingInterfaceIds.push(edge.id);
    }
    for (const functionId of edge.producerFunctionIds) {
      const fn = functions.get(functionId);
      if (fn && !fn.outputInterfaceIds.includes(edge.id)) {
        mismatches.push(
          `${edge.id} names ${functionId} as a producer, but the function does not declare that output.`,
        );
      }
    }
    for (const functionId of edge.consumerFunctionIds) {
      const fn = functions.get(functionId);
      if (fn && !fn.inputInterfaceIds.includes(edge.id)) {
        mismatches.push(
          `${edge.id} names ${functionId} as a consumer, but the function does not declare that input.`,
        );
      }
    }
  }

  for (const fn of graph.functions) {
    for (const interfaceId of fn.inputInterfaceIds) {
      const edge = edges.get(interfaceId);
      if (edge && !edge.consumerFunctionIds.includes(fn.id)) {
        mismatches.push(
          `${fn.id} declares ${interfaceId} as an input, but the interface does not name the function as a consumer.`,
        );
      }
    }
    for (const interfaceId of fn.outputInterfaceIds) {
      const edge = edges.get(interfaceId);
      if (edge && !edge.producerFunctionIds.includes(fn.id)) {
        mismatches.push(
          `${fn.id} declares ${interfaceId} as an output, but the interface does not name the function as a producer.`,
        );
      }
    }
  }

  for (const fn of requiredEssentialFunctions(graph)) {
    if (fn.outputInterfaceIds.length === 0) danglingInterfaceIds.push(`function:${fn.id}`);
  }

  return {
    danglingInterfaceIds: dedupe(danglingInterfaceIds),
    mismatches: dedupe(mismatches),
  };
}

function missingHumanRoles(graph: CapabilityGraph): string[] {
  const roles = new Map(graph.humanRoles.map((role) => [role.id, role]));
  const missing: string[] = [];

  for (const fn of graph.functions) {
    if (HUMAN_IN_LOOP_LEVELS.has(fn.automationLevel)) {
      if (fn.humanRoleIds.length === 0) {
        missing.push(fn.id);
        continue;
      }
      const reciprocal = fn.humanRoleIds.some((roleId) =>
        roles.get(roleId)?.functionIds.includes(fn.id),
      );
      if (!reciprocal) missing.push(fn.id);
    }
  }

  for (const role of graph.humanRoles) {
    for (const functionId of role.functionIds) {
      const fn = graph.functions.find((candidate) => candidate.id === functionId);
      if (fn && !fn.humanRoleIds.includes(role.id)) missing.push(functionId);
    }
  }

  return dedupe(missing);
}

function incompleteConstraints(graph: CapabilityGraph): string[] {
  const incomplete: string[] = [];
  for (const key of CONSTRAINT_KEYS) {
    const set = graph.constraintEnvelope[key];
    if (set.state === "unresolved") incomplete.push(key);
    if (set.state === "defined" && set.items.length === 0) incomplete.push(key);
    if (set.state === "not_applicable" && !set.note?.trim()) incomplete.push(key);
  }
  return incomplete;
}

function pullList(result: Omit<CapabilityGraphGateResult, "pullList">): string[] {
  const pulls: string[] = [];
  if (result.state === "goal_not_admitted") {
    pulls.push("Pass the GARPA offering and mission-goal gates before decomposing capability functions.");
  }
  if (result.state === "mission_digest_mismatch") {
    pulls.push("Regenerate or explicitly migrate the capability graph against the current mission-outcome digest.");
  }
  for (const key of result.uncoveredRequirementKeys) {
    pulls.push(`Trace mission requirement ${key} to at least one implementation-neutral function.`);
  }
  for (const id of result.unresolvedEssentialFunctionIds) {
    pulls.push(`Resolve essential function ${id} as required, excluded with a changed mission, or remove its essential classification.`);
  }
  for (const id of result.orphanEssentialFunctionIds) {
    pulls.push(`Attach essential function ${id} to a mission requirement trace.`);
  }
  for (const id of result.danglingInterfaceIds) {
    pulls.push(`Resolve producer, consumer, external source, or terminal purpose for ${id}.`);
  }
  for (const finding of result.interfaceMismatchFindings) pulls.push(finding);
  for (const id of result.missingHumanRoleFunctionIds) {
    pulls.push(`Assign and reciprocally link a human role for function ${id}.`);
  }
  for (const key of result.incompleteConstraintSets) {
    pulls.push(`Define the ${key} constraint set or record a supported not-applicable rationale.`);
  }
  for (const id of result.missingAuthorizationFunctionIds) {
    pulls.push(`Define the authorization boundary for function ${id}.`);
  }
  for (const id of result.vendorLeakageFunctionIds) {
    pulls.push(`Rewrite required vendor-specific function ${id} as an implementation-neutral mission function.`);
  }
  return dedupe(pulls);
}

export function runCapabilityGraphGate(
  graph: CapabilityGraph,
  outcome: MissionOutcome,
  admission: GarpaAdmissionResult,
  expectedMissionOutcomeDigest: string,
): CapabilityGraphGateResult {
  const requiredRequirementKeys = requiredMissionRequirementKeys(outcome);
  const tracedKeys = new Set(
    graph.traces
      .filter((trace) => trace.functionIds.length > 0)
      .map((trace) => trace.requirementKey),
  );
  const uncoveredRequirementKeys = requiredRequirementKeys.filter(
    (key) => !tracedKeys.has(key),
  );

  const unresolvedEssentialFunctionIds = graph.functions
    .filter(
      (fn) => fn.functionClass === "essential" && fn.state !== "required",
    )
    .map((fn) => fn.id);

  const tracedFunctionIds = new Set(
    graph.traces.flatMap((trace) => trace.functionIds),
  );
  const orphanEssentialFunctionIds = requiredEssentialFunctions(graph)
    .filter((fn) => !tracedFunctionIds.has(fn.id))
    .map((fn) => fn.id);

  const interfaceResult = interfaceFindings(graph);
  const missingHumanRoleFunctionIds = missingHumanRoles(graph);
  const incompleteConstraintSets = incompleteConstraints(graph);
  const missingAuthorizationFunctionIds = graph.functions
    .filter(
      (fn) =>
        fn.requiresAuthorizationBoundary &&
        !fn.authorizationBoundary?.trim(),
    )
    .map((fn) => fn.id);
  const vendorLeakageFunctionIds = graph.functions
    .filter(
      (fn) =>
        fn.state === "required" &&
        (fn.functionClass === "vendor_specific" || fn.origin === "vendor_specific"),
    )
    .map((fn) => fn.id);

  const state = !admission.passed
    ? "goal_not_admitted"
    : graph.missionOutcomeDigest !== expectedMissionOutcomeDigest
      ? "mission_digest_mismatch"
      : uncoveredRequirementKeys.length > 0 || orphanEssentialFunctionIds.length > 0
        ? "mission_trace_incomplete"
        : unresolvedEssentialFunctionIds.length > 0
          ? "essential_function_unresolved"
          : interfaceResult.danglingInterfaceIds.length > 0 ||
              interfaceResult.mismatches.length > 0
            ? "interface_graph_incomplete"
            : missingHumanRoleFunctionIds.length > 0
              ? "human_role_missing"
              : incompleteConstraintSets.length > 0
                ? "constraint_envelope_incomplete"
                : missingAuthorizationFunctionIds.length > 0
                  ? "authorization_boundary_missing"
                  : vendorLeakageFunctionIds.length > 0
                    ? "vendor_architecture_leakage"
                    : "admitted_for_substitution";

  const withoutPulls: Omit<CapabilityGraphGateResult, "pullList"> = {
    state,
    passed: state === "admitted_for_substitution",
    requiredRequirementKeys,
    uncoveredRequirementKeys,
    unresolvedEssentialFunctionIds,
    orphanEssentialFunctionIds,
    danglingInterfaceIds: interfaceResult.danglingInterfaceIds,
    interfaceMismatchFindings: interfaceResult.mismatches,
    missingHumanRoleFunctionIds,
    incompleteConstraintSets,
    missingAuthorizationFunctionIds,
    vendorLeakageFunctionIds,
  };

  return { ...withoutPulls, pullList: pullList(withoutPulls) };
}
