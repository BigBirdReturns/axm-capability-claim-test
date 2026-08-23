import type {
  ArchitectureGateResult,
  ArchitectureRisk,
  CandidateArchitecture,
} from "../../types/garpaArchitecture";
import type { CapabilityGraph } from "../../types/garpaCapability";
import type {
  SubstitutionGateResult,
  SubstitutionPlan,
} from "../../types/garpaSubstitution";

const REQUIRED_COST_CATEGORIES = [
  "hardware",
  "software",
  "integration_labor",
  "operator_labor",
  "qualification",
  "contingency",
] as const;

const REQUIRED_SCHEDULE_PHASES = [
  "procurement",
  "integration",
  "qualification",
] as const;

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function selectedCompleteOptions(
  architecture: CandidateArchitecture,
  plan: SubstitutionPlan,
) {
  const selected = new Set(architecture.selectedOptionIds);
  return plan.options.filter(
    (option) =>
      selected.has(option.id) &&
      option.coverage === "complete_candidate" &&
      ["established", "reported"].includes(option.maturity),
  );
}

function scheduleHasCycle(architecture: CandidateArchitecture): boolean {
  const predecessors = new Map(
    architecture.scheduleEnvelope.lines.map((line) => [
      line.id,
      line.predecessorIds,
    ]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const predecessor of predecessors.get(id) ?? []) {
      if (visit(predecessor)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  return [...predecessors.keys()].some(visit);
}

function riskControlled(risk: ArchitectureRisk): boolean {
  if (!["mission_failure", "unsafe"].includes(risk.consequence)) return true;
  if (
    risk.closureState === "mitigated_by_design" &&
    risk.mitigation.length > 0
  ) {
    return true;
  }
  return (
    risk.closureState === "requires_test" &&
    risk.mitigation.length > 0 &&
    risk.qualificationTestIds.length > 0
  );
}

function buildPullList(result: Omit<ArchitectureGateResult, "pullList">): string[] {
  const pulls: string[] = [];
  if (result.state === "substitution_not_admitted") {
    pulls.push("Pass the GARPA substitution gate before assembling a candidate architecture.");
  }
  if (result.state === "upstream_digest_mismatch") {
    pulls.push("Regenerate or explicitly migrate the architecture against the current mission, capability-graph, and substitution-plan digests.");
  }
  for (const id of result.missingOptionIds) {
    pulls.push(`Select an admitted complete substitution option for ${id}.`);
  }
  for (const id of result.missingComponentIds) {
    pulls.push(`Add component ${id} to the architecture with quantity, role, and configuration.`);
  }
  for (const id of result.unresolvedConfigurationIds) {
    pulls.push(`Resolve the versioned configuration for ${id}.`);
  }
  for (const id of result.missingCompatibilityEdgeIds) {
    pulls.push(`Select an admitted compatibility edge for ${id}.`);
  }
  for (const id of result.missingCustomCodeIds) {
    pulls.push(`Add bounded custom-code component ${id} to the architecture.`);
  }
  for (const id of result.missingHumanRoleIds) {
    pulls.push(`Assign staffing and responsibilities for human role ${id}.`);
  }
  for (const id of result.missingDependencyIds) {
    pulls.push(`Resolve provider, availability, and fallback for external dependency ${id}.`);
  }
  pulls.push(...result.costFindings, ...result.scheduleFindings);
  for (const id of result.uncontrolledRiskIds) {
    pulls.push(`Mitigate or attach a qualification test to high-consequence risk ${id}.`);
  }
  for (const id of result.uncoveredResidualOptionIds) {
    pulls.push(`Carry the residuals from selected substitution option ${id} into the architecture register.`);
  }
  for (const id of result.uncoveredResidualComponentIds) {
    pulls.push(`Carry the residuals from selected component ${id} into the architecture register.`);
  }
  if (result.state === "state_transition_invalid") {
    pulls.push("Keep the architecture in candidate state until a qualification contract admits integration readiness.");
  }
  return dedupe(pulls);
}

export function runArchitectureGate(
  architecture: CandidateArchitecture,
  graph: CapabilityGraph,
  plan: SubstitutionPlan,
  substitutionGate: SubstitutionGateResult,
  expectedSubstitutionPlanDigest: string,
): ArchitectureGateResult {
  const completeOptions = selectedCompleteOptions(architecture, plan);
  const requiredFunctionIds = graph.functions
    .filter((fn) => fn.functionClass === "essential" && fn.state === "required")
    .map((fn) => fn.id);

  const missingOptionIds = requiredFunctionIds.flatMap((functionId) => {
    if (completeOptions.some((option) => option.functionId === functionId)) return [];
    const candidates = plan.options
      .filter(
        (option) =>
          option.functionId === functionId &&
          option.coverage === "complete_candidate" &&
          ["established", "reported"].includes(option.maturity),
      )
      .map((option) => option.id);
    return candidates.length > 0 ? candidates : [`function:${functionId}`];
  });

  const requiredComponentIds = new Set(
    completeOptions.flatMap((option) => option.componentIds),
  );
  const selectedComponentIds = new Set(
    architecture.componentSelections.map((selection) => selection.componentId),
  );
  const missingComponentIds = [...requiredComponentIds].filter(
    (id) => !selectedComponentIds.has(id),
  );

  const requiredCustomCodeIds = new Set(
    completeOptions.flatMap((option) => option.customCodeIds),
  );
  const selectedCustomCodeIds = new Set(
    architecture.customCodeSelections.map((selection) => selection.customCodeId),
  );
  const missingCustomCodeIds = [...requiredCustomCodeIds].filter(
    (id) => !selectedCustomCodeIds.has(id),
  );

  const unresolvedConfigurationIds = [
    ...architecture.componentSelections
      .filter(
        (selection) =>
          selection.configurationState !== "defined" ||
          Object.keys(selection.configuration).length === 0,
      )
      .map((selection) => selection.componentId),
    ...architecture.customCodeSelections
      .filter(
        (selection) =>
          selection.configurationState !== "defined" ||
          Object.keys(selection.configuration).length === 0,
      )
      .map((selection) => selection.customCodeId),
  ];

  const internalInterfaceIds = graph.interfaces
    .filter(
      (edge) =>
        edge.producerFunctionIds.length > 0 && edge.consumerFunctionIds.length > 0,
    )
    .map((edge) => edge.id);
  const selectedCompatibilityIds = new Set(
    architecture.compatibilitySelections.map(
      (selection) => selection.compatibilityEdgeId,
    ),
  );
  const missingCompatibilityEdgeIds = internalInterfaceIds.flatMap((interfaceId) => {
    const candidates = plan.compatibilityEdges
      .filter(
        (edge) =>
          edge.interfaceId === interfaceId &&
          [
            "confirmed_compatible",
            "reported_compatible",
            "adapter_required",
          ].includes(edge.state),
      )
      .map((edge) => edge.id);
    return candidates.some((id) => selectedCompatibilityIds.has(id))
      ? []
      : candidates.length > 0
        ? candidates
        : [`interface:${interfaceId}`];
  });

  for (const selection of architecture.compatibilitySelections) {
    const edge = plan.compatibilityEdges.find(
      (candidate) => candidate.id === selection.compatibilityEdgeId,
    );
    if (!edge) continue;
    for (const id of [
      ...edge.producerComponentIds,
      ...edge.consumerComponentIds,
      ...edge.adapterComponentIds,
    ]) {
      if (!selectedComponentIds.has(id)) missingComponentIds.push(id);
    }
    for (const id of edge.customCodeIds) {
      if (!selectedCustomCodeIds.has(id)) missingCustomCodeIds.push(id);
    }
  }

  const requiredHumanRoleIds = graph.humanRoles.map((role) => role.id);
  const selectedHumanRoleIds = new Set(
    architecture.humanRoleSelections.map((selection) => selection.humanRoleId),
  );
  const missingHumanRoleIds = requiredHumanRoleIds.filter(
    (id) => !selectedHumanRoleIds.has(id),
  );

  const requiredDependencyIds = graph.externalDependencies.map(
    (dependency) => dependency.id,
  );
  const selectedDependencyIds = new Set(
    architecture.dependencySelections.map((selection) => selection.dependencyId),
  );
  const missingDependencyIds = requiredDependencyIds.filter(
    (id) => !selectedDependencyIds.has(id),
  );

  const costFindings: string[] = [];
  for (const category of REQUIRED_COST_CATEGORIES) {
    if (!architecture.costEnvelope.lines.some((line) => line.category === category)) {
      costFindings.push(`The architecture cost envelope omits required category ${category}.`);
    }
  }
  for (const line of architecture.costEnvelope.lines) {
    if (line.currency !== architecture.costEnvelope.currency) {
      costFindings.push(`Cost line ${line.id} uses a currency outside the envelope currency.`);
    }
    if (line.confidence === "open") {
      costFindings.push(`Cost line ${line.id} remains open rather than estimated.`);
    }
  }

  const scheduleFindings: string[] = [];
  for (const phase of REQUIRED_SCHEDULE_PHASES) {
    if (!architecture.scheduleEnvelope.lines.some((line) => line.phase === phase)) {
      scheduleFindings.push(`The architecture schedule omits required phase ${phase}.`);
    }
  }
  if (scheduleHasCycle(architecture)) {
    scheduleFindings.push("The architecture schedule contains a predecessor cycle.");
  }

  const uncontrolledRiskIds = architecture.risks
    .filter((risk) => !riskControlled(risk))
    .map((risk) => risk.id);

  const residualOptionCoverage = new Set(
    architecture.residuals.flatMap((residual) => residual.sourceOptionIds),
  );
  const residualComponentCoverage = new Set(
    architecture.residuals.flatMap((residual) => residual.sourceComponentIds),
  );
  const uncoveredResidualOptionIds = completeOptions
    .filter(
      (option) =>
        option.residuals.length > 0 && !residualOptionCoverage.has(option.id),
    )
    .map((option) => option.id);
  const uncoveredResidualComponentIds = [...requiredComponentIds].filter(
    (componentId) => {
      const component = plan.components.find(
        (candidate) => candidate.id === componentId,
      );
      return (
        (component?.residuals.length ?? 0) > 0 &&
        !residualComponentCoverage.has(componentId)
      );
    },
  );

  const state = !substitutionGate.passed
    ? "substitution_not_admitted"
    : architecture.missionOutcomeDigest !== graph.missionOutcomeDigest ||
        architecture.capabilityGraphDigest !== plan.capabilityGraphDigest ||
        architecture.substitutionPlanDigest !== expectedSubstitutionPlanDigest
      ? "upstream_digest_mismatch"
      : missingOptionIds.length > 0
        ? "option_selection_incomplete"
        : missingComponentIds.length > 0 || unresolvedConfigurationIds.length > 0
          ? "component_selection_incomplete"
          : missingCompatibilityEdgeIds.length > 0
            ? "compatibility_selection_incomplete"
            : missingCustomCodeIds.length > 0
              ? "custom_code_selection_incomplete"
              : missingHumanRoleIds.length > 0
                ? "human_role_unresolved"
                : missingDependencyIds.length > 0
                  ? "external_dependency_unresolved"
                  : costFindings.length > 0
                    ? "cost_envelope_incomplete"
                    : scheduleFindings.length > 0
                      ? "schedule_envelope_incomplete"
                      : uncontrolledRiskIds.length > 0
                        ? "high_consequence_risk_uncontrolled"
                        : uncoveredResidualOptionIds.length > 0 ||
                            uncoveredResidualComponentIds.length > 0
                          ? "residual_register_incomplete"
                          : architecture.state !== "candidate"
                            ? "state_transition_invalid"
                            : "admitted_for_qualification";

  const withoutPulls: Omit<ArchitectureGateResult, "pullList"> = {
    state,
    passed: state === "admitted_for_qualification",
    missingOptionIds: dedupe(missingOptionIds),
    missingComponentIds: dedupe(missingComponentIds),
    unresolvedConfigurationIds: dedupe(unresolvedConfigurationIds),
    missingCompatibilityEdgeIds: dedupe(missingCompatibilityEdgeIds),
    missingCustomCodeIds: dedupe(missingCustomCodeIds),
    missingHumanRoleIds,
    missingDependencyIds,
    costFindings: dedupe(costFindings),
    scheduleFindings: dedupe(scheduleFindings),
    uncontrolledRiskIds,
    uncoveredResidualOptionIds,
    uncoveredResidualComponentIds,
  };

  return { ...withoutPulls, pullList: buildPullList(withoutPulls) };
}
