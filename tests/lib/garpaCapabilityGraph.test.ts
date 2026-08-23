import { describe, expect, it } from "vitest";
import packetRaw from "../../examples/garpa-capability-graph/claim-packet.json";
import outcomeRaw from "../../examples/garpa-capability-graph/mission-outcome.json";
import graphRaw from "../../examples/garpa-capability-graph/capability-graph.json";
import vectusPacketRaw from "../../examples/garpa-vectus/claim-packet.json";
import vectusOutcomeRaw from "../../examples/garpa-vectus/mission-outcome.json";
import type { CapabilityGraph } from "../../app/src/types/garpaCapability";
import {
  validateClaimPacket,
  validateMissionOutcome,
} from "../../app/src/lib/garpa/validateClaimPacket";
import { runGarpaAdmission } from "../../app/src/lib/garpa/runGarpaAdmission";
import { validateCapabilityGraph } from "../../app/src/lib/garpa/validateCapabilityGraph";
import { runCapabilityGraphGate } from "../../app/src/lib/garpa/runCapabilityGraphGate";
import { renderCapabilityGraphBrief } from "../../app/src/lib/garpa/renderCapabilityGraphBrief";

function fixture() {
  const packet = validateClaimPacket(packetRaw);
  expect(packet.ok, packet.errors.join("; ")).toBe(true);
  const outcome = validateMissionOutcome(outcomeRaw, packet.value);
  expect(outcome.ok, outcome.errors.join("; ")).toBe(true);
  const admission = runGarpaAdmission(packet.value!, outcome.value!);
  expect(admission.passed).toBe(true);
  const graph = validateCapabilityGraph(graphRaw, packet.value, outcome.value);
  expect(graph.ok, graph.errors.join("; ")).toBe(true);
  return {
    packet: packet.value!,
    outcome: outcome.value!,
    admission,
    graph: graph.value!,
  };
}

function cloneGraph(graph: CapabilityGraph): CapabilityGraph {
  return structuredClone(graph);
}

function functionById(graph: CapabilityGraph, id: string) {
  const fn = graph.functions.find((candidate) => candidate.id === id);
  expect(fn).toBeDefined();
  return fn!;
}

describe("GARPA capability graph validation", () => {
  it("accepts the source-addressable example graph", () => {
    const { graph } = fixture();
    expect(graph.functions.length).toBe(4);
    expect(graph.traces.length).toBe(7);
  });

  it("rejects unresolved interfaces and evidence ids", () => {
    const { packet, outcome, graph } = fixture();
    const raw = cloneGraph(graph);
    raw.functions[0]!.inputInterfaceIds = ["ghost-interface"];
    raw.functions[0]!.evidenceCellIds = ["ghost-evidence"];
    const result = validateCapabilityGraph(raw, packet, outcome);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("unknown interface");
    expect(result.errors.join(" ")).toContain("unknown evidence");
  });

  it("requires metric ids only on success-metric traces", () => {
    const { packet, outcome, graph } = fixture();
    const raw = cloneGraph(graph);
    const metricTrace = raw.traces.find(
      (trace) => trace.missionField === "success_metric",
    )!;
    delete metricTrace.metricId;
    const result = validateCapabilityGraph(raw, packet, outcome);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("success_metric traces require metricId");
  });
});

describe("GARPA capability graph gate", () => {
  it("admits the implementation-neutral example for substitution research", () => {
    const { outcome, admission, graph } = fixture();
    const result = runCapabilityGraphGate(
      graph,
      outcome,
      admission,
      graph.missionOutcomeDigest,
    );
    expect(result.passed).toBe(true);
    expect(result.state).toBe("admitted_for_substitution");
    expect(result.pullList).toEqual([]);
  });

  it("short-circuits when the offering and goal are not admitted", () => {
    const vectusPacket = validateClaimPacket(vectusPacketRaw);
    const vectusOutcome = validateMissionOutcome(
      vectusOutcomeRaw,
      vectusPacket.value,
    );
    const blockedAdmission = runGarpaAdmission(
      vectusPacket.value!,
      vectusOutcome.value!,
    );
    const { graph, outcome } = fixture();
    const result = runCapabilityGraphGate(
      graph,
      outcome,
      blockedAdmission,
      graph.missionOutcomeDigest,
    );
    expect(result.state).toBe("admission_not_passed");
    expect(result.uncoveredMissionFields).toEqual([]);
    expect(result.danglingInterfaceIds).toEqual([]);
    expect(result.pullList).toHaveLength(1);
  });

  it("invalidates a graph built against a different mission outcome", () => {
    const { graph, outcome, admission } = fixture();
    const result = runCapabilityGraphGate(
      graph,
      outcome,
      admission,
      "sha256:changed-mission",
    );
    expect(result.state).toBe("mission_digest_mismatch");
    expect(result.pullList).toHaveLength(1);
  });

  it("blocks an untraced success metric", () => {
    const { graph, outcome, admission } = fixture();
    const raw = cloneGraph(graph);
    raw.traces = raw.traces.filter(
      (trace) => trace.metricId !== "m_detect_before_boundary",
    );
    const result = runCapabilityGraphGate(
      raw,
      outcome,
      admission,
      raw.missionOutcomeDigest,
    );
    expect(result.state).toBe("mission_trace_incomplete");
    expect(result.uncoveredMetricIds).toContain("m_detect_before_boundary");
  });

  it("blocks an orphan essential function", () => {
    const { graph, outcome, admission } = fixture();
    const raw = cloneGraph(graph);
    raw.functions.push({
      id: "f_orphan",
      name: "Operate a vendor-branded subsystem",
      purpose: "A deliberately untraced essential function for the hostile fixture.",
      functionClass: "essential",
      state: "required",
      inputInterfaceIds: [],
      outputInterfaceIds: [],
      functionDependencyIds: [],
      externalDependencyIds: [],
      automationLevel: "bounded_autonomy",
      humanRoleIds: [],
      consequenceClass: "routine",
      evidenceCellIds: [],
      assumptions: [],
      failureModes: [],
      residualQuestions: [],
    });
    const result = runCapabilityGraphGate(
      raw,
      outcome,
      admission,
      raw.missionOutcomeDigest,
    );
    expect(result.state).toBe("essential_function_unresolved");
    expect(result.orphanEssentialFunctionIds).toContain("f_orphan");
  });

  it("blocks a dangling interface", () => {
    const { graph, outcome, admission } = fixture();
    const raw = cloneGraph(graph);
    const recordInterface = raw.interfaces.find(
      (interf) => interf.id === "i_replay_record",
    )!;
    recordInterface.terminal = false;
    const result = runCapabilityGraphGate(
      raw,
      outcome,
      admission,
      raw.missionOutcomeDigest,
    );
    expect(result.state).toBe("interface_graph_incomplete");
    expect(result.danglingInterfaceIds).toContain("i_replay_record");
  });

  it("blocks decision support with no assigned human role", () => {
    const { graph, outcome, admission } = fixture();
    const raw = cloneGraph(graph);
    functionById(raw, "f_present_notification").humanRoleIds = [];
    const result = runCapabilityGraphGate(
      raw,
      outcome,
      admission,
      raw.missionOutcomeDigest,
    );
    expect(result.state).toBe("human_role_missing");
    expect(result.missingHumanRoleFunctionIds).toContain(
      "f_present_notification",
    );
  });

  it("blocks incomplete constraint sections", () => {
    const { graph, outcome, admission } = fixture();
    const raw = cloneGraph(graph);
    raw.constraintEnvelope.economic.state = "partial";
    raw.constraintEnvelope.economic.openQuestions = [
      "What numerical budget ceiling applies?",
    ];
    const result = runCapabilityGraphGate(
      raw,
      outcome,
      admission,
      raw.missionOutcomeDigest,
    );
    expect(result.state).toBe("constraint_envelope_incomplete");
    expect(result.incompleteConstraintSections).toContain("economic");
  });

  it("blocks safety-critical functions without an authority boundary", () => {
    const { graph, outcome, admission } = fixture();
    const raw = cloneGraph(graph);
    const fn = functionById(raw, "f_present_notification");
    fn.automationLevel = "bounded_autonomy";
    fn.consequenceClass = "safety_critical";
    delete fn.authorityBoundary;
    const result = runCapabilityGraphGate(
      raw,
      outcome,
      admission,
      raw.missionOutcomeDigest,
    );
    expect(result.state).toBe("authorization_boundary_missing");
    expect(result.missingAuthorityFunctionIds).toContain(
      "f_present_notification",
    );
  });

  it("blocks required vendor-specific functions", () => {
    const { graph, outcome, admission } = fixture();
    const raw = cloneGraph(graph);
    functionById(raw, "f_present_notification").functionClass =
      "vendor_specific";
    const result = runCapabilityGraphGate(
      raw,
      outcome,
      admission,
      raw.missionOutcomeDigest,
    );
    expect(result.state).toBe("vendor_architecture_leakage");
    expect(result.vendorLeakageFunctionIds).toContain(
      "f_present_notification",
    );
  });

  it("requires dependency cycles to be declared as feedback loops", () => {
    const { graph, outcome, admission } = fixture();
    const raw = cloneGraph(graph);
    functionById(raw, "f_observe_environment").functionDependencyIds = [
      "f_present_notification",
    ];
    const blocked = runCapabilityGraphGate(
      raw,
      outcome,
      admission,
      raw.missionOutcomeDigest,
    );
    expect(blocked.state).toBe("interface_graph_incomplete");
    expect(blocked.undeclaredDependencyCycles).not.toEqual([]);

    raw.feedbackLoops = [
      {
        id: "loop_observe_detect_present",
        name: "Observation and operator feedback loop",
        functionIds: [
          "f_observe_environment",
          "f_detect_candidate",
          "f_present_notification",
        ],
        interfaceIds: ["i_observation_stream", "i_detection_event"],
        rationale:
          "The hostile fixture declares the cycle explicitly rather than leaving an accidental dependency loop.",
      },
    ];
    const admitted = runCapabilityGraphGate(
      raw,
      outcome,
      admission,
      raw.missionOutcomeDigest,
    );
    expect(admitted.state).toBe("admitted_for_substitution");
  });
});

describe("GARPA capability graph brief", () => {
  it("renders a bounded graph result without selecting components", () => {
    const { graph, outcome, admission } = fixture();
    const gate = runCapabilityGraphGate(
      graph,
      outcome,
      admission,
      graph.missionOutcomeDigest,
    );
    const brief = renderCapabilityGraphBrief(graph, gate);
    expect(brief).toContain("Substitution planning: admitted");
    expect(brief).toContain("No component or vendor has been selected");
    expect(brief).toContain("No bill of materials or candidate architecture");
  });
});
