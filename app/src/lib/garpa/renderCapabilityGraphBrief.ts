import type {
  CapabilityGraph,
  CapabilityGraphGateResult,
} from "../../types/garpaCapability";

function bullets(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

function findingLines(result: CapabilityGraphGateResult): string[] {
  return [
    ...result.uncoveredMissionFields.map((value) => `Uncovered mission field: ${value}`),
    ...result.uncoveredMetricIds.map((value) => `Uncovered success metric: ${value}`),
    ...result.orphanEssentialFunctionIds.map((value) => `Orphan essential function: ${value}`),
    ...result.unresolvedFunctionIds.map((value) => `Unresolved function: ${value}`),
    ...result.danglingInterfaceIds.map((value) => `Dangling interface: ${value}`),
    ...result.unresolvedDependencyIds.map((value) => `Unresolved dependency: ${value}`),
    ...result.undeclaredDependencyCycles.map((value) => `Undeclared dependency cycle: ${value}`),
    ...result.missingHumanRoleFunctionIds.map((value) => `Missing human role: ${value}`),
    ...result.incompleteConstraintSections.map((value) => `Incomplete constraint section: ${value}`),
    ...result.missingAuthorityFunctionIds.map((value) => `Missing authority boundary: ${value}`),
    ...result.vendorLeakageFunctionIds.map((value) => `Required vendor-specific function: ${value}`),
  ];
}

export function renderCapabilityGraphBrief(
  graph: CapabilityGraph,
  result: CapabilityGraphGateResult,
): string {
  const requiredFunctions = graph.functions.filter((fn) => fn.state === "required");
  const essentialFunctions = requiredFunctions.filter(
    (fn) => fn.functionClass === "essential",
  );
  const findings = findingLines(result);

  return [
    `# GARPA Capability Graph — ${graph.caseId}`,
    ``,
    `## State`,
    `- Admission predecessor: ${result.admissionState}`,
    `- Graph gate: ${result.state}`,
    `- Substitution planning: ${result.passed ? "admitted" : "blocked"}`,
    `- Mission outcome digest: ${graph.missionOutcomeDigest}`,
    ``,
    `## Graph`,
    `- Required functions: ${requiredFunctions.length}`,
    `- Essential functions: ${essentialFunctions.length}`,
    `- Interfaces: ${graph.interfaces.length}`,
    `- Requirement traces: ${graph.traces.length}`,
    `- Human roles: ${graph.humanRoles.length}`,
    `- External dependencies: ${graph.externalDependencies.length}`,
    ``,
    `## Essential functions`,
    ...bullets(essentialFunctions.map((fn) => `${fn.id}: ${fn.name} — ${fn.purpose}`)),
    ``,
    `## Gate findings`,
    ...bullets(findings),
    ``,
    `## Required next work`,
    ...bullets(result.pullList),
    ``,
    `## Boundary`,
    `- No component or vendor has been selected by this graph.`,
    `- No bill of materials or candidate architecture has been generated.`,
    `- Admission means only that the mission can proceed to substitution research.`,
    ``,
    `## Control question`,
    result.passed
      ? "Which essential function should be challenged first because failure there would invalidate the cheapest proposed substitution?"
      : "What is the smallest correction that would close the controlling graph-gate failure without importing a vendor implementation as a mission requirement?",
    ``,
  ].join("\n");
}
