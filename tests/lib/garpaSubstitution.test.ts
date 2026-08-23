import { describe, expect, it } from "vitest";
import packetRaw from "../../examples/garpa-synthetic-observation/claim-packet.json";
import outcomeRaw from "../../examples/garpa-synthetic-observation/mission-outcome.json";
import graphRaw from "../../examples/garpa-synthetic-observation/capability-graph.json";
import planRaw from "../../examples/garpa-synthetic-observation/substitution-plan.json";
import type {
  ClaimPacket,
  GarpaAdmissionResult,
  MissionOutcome,
} from "../../app/src/types/garpa";
import type {
  CapabilityGraph,
  CapabilityGraphGateResult,
} from "../../app/src/types/garpaCapability";
import type {
  SubstitutionPlan,
} from "../../app/src/types/garpaSubstitution";
import {
  validateClaimPacket,
  validateMissionOutcome,
} from "../../app/src/lib/garpa/validateClaimPacket";
import { runGarpaAdmission } from "../../app/src/lib/garpa/runGarpaAdmission";
import { validateCapabilityGraph } from "../../app/src/lib/garpa/validateCapabilityGraph";
import { runCapabilityGraphGate } from "../../app/src/lib/garpa/runCapabilityGraphGate";
import { validateSubstitutionPlan } from "../../app/src/lib/garpa/validateSubstitutionPlan";
import { runSubstitutionGate } from "../../app/src/lib/garpa/runSubstitutionGate";

const MISSION_DIGEST = "sha256:synthetic-observation-mission-v1";
const GRAPH_DIGEST = "sha256:synthetic-observation-graph-v1";

interface Fixture {
  packet: ClaimPacket;
  outcome: MissionOutcome;
  admission: GarpaAdmissionResult;
  graph: CapabilityGraph;
  graphGate: CapabilityGraphGateResult;
  plan: SubstitutionPlan;
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

  const admission = runGarpaAdmission(packet.value!, outcome.value!);
  expect(admission.passed).toBe(true);
  const graphGate = runCapabilityGraphGate(
    graph.value!,
    outcome.value!,
    admission,
    MISSION_DIGEST,
  );
  expect(graphGate.passed, graphGate.pullList.join("; ")).toBe(true);

  return {
    packet: packet.value!,
    outcome: outcome.value!,
    admission,
    graph: graph.value!,
    graphGate,
    plan: plan.value!,
  };
}

describe("GARPA substitution-plan validation", () => {
  it("accepts the source-addressable synthetic substitution plan", () => {
    const { packet, graph } = fixture();
    const result = validateSubstitutionPlan(planRaw, graph, packet);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects unresolved graph and component references", () => {
    const { packet, graph, plan } = fixture();
    const broken = structuredClone(plan);
    broken.components[0]!.functionIds = ["ghost-function"];
    broken.options[0]!.componentIds = ["ghost-component"];
    const result = validateSubstitutionPlan(broken, graph, packet);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("unknown function");
    expect(result.errors.join(" ")).toContain("unknown component");
  });
});

describe("GARPA substitution gate", () => {
  it("admits the bounded synthetic composition for architecture work", () => {
    const { packet, graph, graphGate, plan } = fixture();
    const result = runSubstitutionGate(
      plan,
      graph,
      graphGate,
      GRAPH_DIGEST,
      packet,
    );
    expect(result.passed, result.pullList.join("; ")).toBe(true);
    expect(result.state).toBe("admitted_for_architecture");
  });

  it("refuses component selection when the capability graph is not admitted", () => {
    const { packet, graph, graphGate, plan } = fixture();
    const blocked: CapabilityGraphGateResult = {
      ...graphGate,
      passed: false,
      state: "mission_trace_incomplete",
    };
    const result = runSubstitutionGate(
      plan,
      graph,
      blocked,
      GRAPH_DIGEST,
      packet,
    );
    expect(result.state).toBe("capability_graph_not_admitted");
  });

  it("invalidates a plan built against a stale capability graph", () => {
    const { packet, graph, graphGate, plan } = fixture();
    const result = runSubstitutionGate(
      plan,
      graph,
      graphGate,
      "sha256:new-graph",
      packet,
    );
    expect(result.state).toBe("graph_digest_mismatch");
  });

  it("blocks vendor-only component performance evidence", () => {
    const { packet, graph, graphGate, plan } = fixture();
    const broken = structuredClone(plan);
    broken.components[0]!.maturity = "vendor_claimed";
    const result = runSubstitutionGate(
      broken,
      graph,
      graphGate,
      GRAPH_DIGEST,
      packet,
    );
    expect(result.state).toBe("component_evidence_insufficient");
    expect(result.weakEvidenceComponentIds).toContain("component-sensor");
  });

  it("blocks an uncovered essential function", () => {
    const { packet, graph, graphGate, plan } = fixture();
    const broken = structuredClone(plan);
    broken.options = broken.options.filter(
      (option) => option.functionId !== "f-detect",
    );
    const result = runSubstitutionGate(
      broken,
      graph,
      graphGate,
      GRAPH_DIGEST,
      packet,
    );
    expect(result.state).toBe("function_coverage_incomplete");
    expect(result.uncoveredFunctionIds).toContain("f-detect");
  });

  it("blocks an unknown compatibility edge", () => {
    const { packet, graph, graphGate, plan } = fixture();
    const broken = structuredClone(plan);
    broken.compatibilityEdges[0]!.state = "unknown";
    const result = runSubstitutionGate(
      broken,
      graph,
      graphGate,
      GRAPH_DIGEST,
      packet,
    );
    expect(result.state).toBe("interface_coverage_incomplete");
    expect(result.incompatibleInterfaceIds).toContain("i-observation");
  });

  it("blocks unbounded custom code even when it is not yet attached to an option", () => {
    const { packet, graph, graphGate, plan } = fixture();
    const broken = structuredClone(plan);
    broken.customCode.push({
      id: "code-magic",
      version: "0",
      functionIds: ["f-detect"],
      interfaceIds: ["i-observation", "i-detection"],
      purpose: "Unspecified integration magic",
      inputs: [],
      outputs: [],
      complexity: "unresolved",
      dependencies: [],
      testStrategy: [],
      safetyProperties: [],
      securityProperties: [],
      residuals: [],
    });
    const result = runSubstitutionGate(
      broken,
      graph,
      graphGate,
      GRAPH_DIGEST,
      packet,
    );
    expect(result.state).toBe("custom_code_unbounded");
    expect(result.unboundedCustomCodeIds).toContain("code-magic");
  });

  it("blocks a substitution option with no residual", () => {
    const { packet, graph, graphGate, plan } = fixture();
    const broken = structuredClone(plan);
    broken.options[0]!.residuals = [];
    const result = runSubstitutionGate(
      broken,
      graph,
      graphGate,
      GRAPH_DIGEST,
      packet,
    );
    expect(result.state).toBe("residual_or_test_missing");
    expect(result.incompleteOptionIds).toContain("option-observe");
  });

  it("blocks an incomplete cost boundary", () => {
    const { packet, graph, graphGate, plan } = fixture();
    const broken = structuredClone(plan);
    broken.costBoundary.state = "partial";
    broken.costBoundary.includedCategories = ["hardware", "software"];
    const result = runSubstitutionGate(
      broken,
      graph,
      graphGate,
      GRAPH_DIGEST,
      packet,
    );
    expect(result.state).toBe("cost_boundary_incomplete");
    expect(result.costBoundaryFindings.join(" ")).toContain("integration_labor");
    expect(result.costBoundaryFindings.join(" ")).toContain("qualification");
  });

  it("does not accept a component version that lacks matching identity evidence", () => {
    const { packet, graph, graphGate, plan } = fixture();
    const broken = structuredClone(plan);
    broken.components[0]!.exactModelOrVersion = "sensor-v2";
    const result = runSubstitutionGate(
      broken,
      graph,
      graphGate,
      GRAPH_DIGEST,
      packet,
    );
    expect(result.state).toBe("component_identity_incomplete");
    expect(result.invalidComponentIds).toContain("component-sensor");
  });
});
