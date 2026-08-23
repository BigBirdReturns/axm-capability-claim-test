import { describe, expect, it } from "vitest";
import packetRaw from "../../examples/garpa-synthetic-observation/claim-packet.json";
import outcomeRaw from "../../examples/garpa-synthetic-observation/mission-outcome.json";
import graphRaw from "../../examples/garpa-synthetic-observation/capability-graph.json";
import planRaw from "../../examples/garpa-synthetic-observation/substitution-plan.json";
import architectureRaw from "../../examples/garpa-synthetic-observation/candidate-architecture.json";
import type { ClaimPacket, MissionOutcome } from "../../app/src/types/garpa";
import type {
  CapabilityGraph,
  CapabilityGraphGateResult,
} from "../../app/src/types/garpaCapability";
import type {
  SubstitutionGateResult,
  SubstitutionPlan,
} from "../../app/src/types/garpaSubstitution";
import type { CandidateArchitecture } from "../../app/src/types/garpaArchitecture";
import {
  validateClaimPacket,
  validateMissionOutcome,
} from "../../app/src/lib/garpa/validateClaimPacket";
import { runGarpaAdmission } from "../../app/src/lib/garpa/runGarpaAdmission";
import { validateCapabilityGraph } from "../../app/src/lib/garpa/validateCapabilityGraph";
import { runCapabilityGraphGate } from "../../app/src/lib/garpa/runCapabilityGraphGate";
import { validateSubstitutionPlan } from "../../app/src/lib/garpa/validateSubstitutionPlan";
import { runSubstitutionGate } from "../../app/src/lib/garpa/runSubstitutionGate";
import { validateCandidateArchitecture } from "../../app/src/lib/garpa/validateCandidateArchitecture";
import { runArchitectureGate } from "../../app/src/lib/garpa/runArchitectureGate";

const MISSION_DIGEST = "sha256:synthetic-observation-mission-v1";
const GRAPH_DIGEST = "sha256:synthetic-observation-graph-v1";
const SUBSTITUTION_DIGEST = "sha256:synthetic-observation-substitution-v1";

interface Fixture {
  packet: ClaimPacket;
  outcome: MissionOutcome;
  graph: CapabilityGraph;
  graphGate: CapabilityGraphGateResult;
  plan: SubstitutionPlan;
  substitutionGate: SubstitutionGateResult;
  architecture: CandidateArchitecture;
}

function fixture(): Fixture {
  const packet = validateClaimPacket(packetRaw);
  expect(packet.ok, packet.errors.join("; ")).toBe(true);
  const outcome = validateMissionOutcome(outcomeRaw, packet.value);
  expect(outcome.ok, outcome.errors.join("; ")).toBe(true);
  const graph = validateCapabilityGraph(graphRaw, packet.value, outcome.value);
  expect(graph.ok, graph.errors.join("; ")).toBe(true);
  const plan = validateSubstitutionPlan(planRaw, graph.value!, packet.value!);
  expect(plan.ok, plan.errors.join("; ")).toBe(true);
  const architecture = validateCandidateArchitecture(
    architectureRaw,
    graph.value!,
    plan.value!,
    packet.value!,
  );
  expect(architecture.ok, architecture.errors.join("; ")).toBe(true);

  const admission = runGarpaAdmission(packet.value!, outcome.value!);
  expect(admission.passed).toBe(true);
  const graphGate = runCapabilityGraphGate(
    graph.value!,
    outcome.value!,
    admission,
    MISSION_DIGEST,
  );
  expect(graphGate.passed, graphGate.pullList.join("; ")).toBe(true);
  const substitutionGate = runSubstitutionGate(
    plan.value!,
    graph.value!,
    graphGate,
    GRAPH_DIGEST,
    packet.value!,
  );
  expect(substitutionGate.passed, substitutionGate.pullList.join("; ")).toBe(true);

  return {
    packet: packet.value!,
    outcome: outcome.value!,
    graph: graph.value!,
    graphGate,
    plan: plan.value!,
    substitutionGate,
    architecture: architecture.value!,
  };
}

describe("GARPA candidate-architecture validation", () => {
  it("accepts the complete synthetic candidate architecture", () => {
    const { packet, graph, plan } = fixture();
    const result = validateCandidateArchitecture(
      architectureRaw,
      graph,
      plan,
      packet,
    );
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects unknown component and schedule references", () => {
    const { packet, graph, plan, architecture } = fixture();
    const broken = structuredClone(architecture);
    broken.componentSelections[0]!.componentId = "ghost-component";
    broken.scheduleEnvelope.lines[0]!.predecessorIds = ["ghost-phase"];
    const result = validateCandidateArchitecture(broken, graph, plan, packet);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("unknown component");
    expect(result.errors.join(" ")).toContain("unknown schedule predecessor");
  });
});

describe("GARPA architecture gate", () => {
  it("admits the synthetic candidate architecture for qualification planning", () => {
    const { graph, plan, substitutionGate, architecture } = fixture();
    const result = runArchitectureGate(
      architecture,
      graph,
      plan,
      substitutionGate,
      SUBSTITUTION_DIGEST,
    );
    expect(result.passed, result.pullList.join("; ")).toBe(true);
    expect(result.state).toBe("admitted_for_qualification");
  });

  it("refuses architecture work when substitution is not admitted", () => {
    const { graph, plan, substitutionGate, architecture } = fixture();
    const blocked: SubstitutionGateResult = {
      ...substitutionGate,
      passed: false,
      state: "function_coverage_incomplete",
    };
    const result = runArchitectureGate(
      architecture,
      graph,
      plan,
      blocked,
      SUBSTITUTION_DIGEST,
    );
    expect(result.state).toBe("substitution_not_admitted");
  });

  it("invalidates a candidate built against a stale substitution plan", () => {
    const { graph, plan, substitutionGate, architecture } = fixture();
    const result = runArchitectureGate(
      architecture,
      graph,
      plan,
      substitutionGate,
      "sha256:new-substitution",
    );
    expect(result.state).toBe("upstream_digest_mismatch");
  });

  it("blocks an unselected essential-function option", () => {
    const { graph, plan, substitutionGate, architecture } = fixture();
    const broken = structuredClone(architecture);
    broken.selectedOptionIds = broken.selectedOptionIds.filter(
      (id) => id !== "option-detect",
    );
    const result = runArchitectureGate(
      broken,
      graph,
      plan,
      substitutionGate,
      SUBSTITUTION_DIGEST,
    );
    expect(result.state).toBe("option_selection_incomplete");
    expect(result.missingOptionIds).toContain("option-detect");
  });

  it("blocks a missing or unresolved component configuration", () => {
    const { graph, plan, substitutionGate, architecture } = fixture();
    const missing = structuredClone(architecture);
    missing.componentSelections = missing.componentSelections.filter(
      (selection) => selection.componentId !== "component-detector",
    );
    const missingResult = runArchitectureGate(
      missing,
      graph,
      plan,
      substitutionGate,
      SUBSTITUTION_DIGEST,
    );
    expect(missingResult.state).toBe("component_selection_incomplete");
    expect(missingResult.missingComponentIds).toContain("component-detector");

    const unresolved = structuredClone(architecture);
    unresolved.componentSelections[0]!.configurationState = "unresolved";
    unresolved.componentSelections[0]!.configuration = {};
    const unresolvedResult = runArchitectureGate(
      unresolved,
      graph,
      plan,
      substitutionGate,
      SUBSTITUTION_DIGEST,
    );
    expect(unresolvedResult.state).toBe("component_selection_incomplete");
    expect(unresolvedResult.unresolvedConfigurationIds).toContain("component-sensor");
  });

  it("blocks a missing internal compatibility selection", () => {
    const { graph, plan, substitutionGate, architecture } = fixture();
    const broken = structuredClone(architecture);
    broken.compatibilitySelections = broken.compatibilitySelections.filter(
      (selection) => selection.interfaceId !== "i-observation",
    );
    const result = runArchitectureGate(
      broken,
      graph,
      plan,
      substitutionGate,
      SUBSTITUTION_DIGEST,
    );
    expect(result.state).toBe("compatibility_selection_incomplete");
    expect(result.missingCompatibilityEdgeIds).toContain("compat-observation");
  });

  it("blocks an unresolved human role", () => {
    const { graph, plan, substitutionGate, architecture } = fixture();
    const broken = structuredClone(architecture);
    broken.humanRoleSelections = [];
    const result = runArchitectureGate(
      broken,
      graph,
      plan,
      substitutionGate,
      SUBSTITUTION_DIGEST,
    );
    expect(result.state).toBe("human_role_unresolved");
    expect(result.missingHumanRoleIds).toContain("role-operator");
  });

  it("blocks incomplete cost and schedule envelopes", () => {
    const { graph, plan, substitutionGate, architecture } = fixture();
    const badCost = structuredClone(architecture);
    badCost.costEnvelope.lines = badCost.costEnvelope.lines.filter(
      (line) => line.category !== "qualification",
    );
    const costResult = runArchitectureGate(
      badCost,
      graph,
      plan,
      substitutionGate,
      SUBSTITUTION_DIGEST,
    );
    expect(costResult.state).toBe("cost_envelope_incomplete");

    const badSchedule = structuredClone(architecture);
    const integration = badSchedule.scheduleEnvelope.lines.find(
      (line) => line.id === "schedule-integration",
    )!;
    const procurement = badSchedule.scheduleEnvelope.lines.find(
      (line) => line.id === "schedule-procurement",
    )!;
    procurement.predecessorIds = [integration.id];
    const scheduleResult = runArchitectureGate(
      badSchedule,
      graph,
      plan,
      substitutionGate,
      SUBSTITUTION_DIGEST,
    );
    expect(scheduleResult.state).toBe("schedule_envelope_incomplete");
    expect(scheduleResult.scheduleFindings.join(" ")).toContain("cycle");
  });

  it("blocks an uncontrolled mission-failure risk", () => {
    const { graph, plan, substitutionGate, architecture } = fixture();
    const broken = structuredClone(architecture);
    const risk = broken.risks.find((candidate) => candidate.id === "risk-detection")!;
    risk.mitigation = [];
    risk.qualificationTestIds = [];
    risk.closureState = "open";
    const result = runArchitectureGate(
      broken,
      graph,
      plan,
      substitutionGate,
      SUBSTITUTION_DIGEST,
    );
    expect(result.state).toBe("high_consequence_risk_uncontrolled");
    expect(result.uncontrolledRiskIds).toContain("risk-detection");
  });

  it("blocks a dropped substitution residual", () => {
    const { graph, plan, substitutionGate, architecture } = fixture();
    const broken = structuredClone(architecture);
    broken.residuals = broken.residuals.filter(
      (residual) => !residual.sourceOptionIds.includes("option-detect"),
    );
    const result = runArchitectureGate(
      broken,
      graph,
      plan,
      substitutionGate,
      SUBSTITUTION_DIGEST,
    );
    expect(result.state).toBe("residual_register_incomplete");
    expect(result.uncoveredResidualOptionIds).toContain("option-detect");
  });

  it("does not permit integration-ready status before qualification exists", () => {
    const { graph, plan, substitutionGate, architecture } = fixture();
    const broken = structuredClone(architecture);
    broken.state = "integration_ready";
    const result = runArchitectureGate(
      broken,
      graph,
      plan,
      substitutionGate,
      SUBSTITUTION_DIGEST,
    );
    expect(result.state).toBe("state_transition_invalid");
  });
});
