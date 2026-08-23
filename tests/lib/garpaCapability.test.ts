import { describe, expect, it } from "vitest";
import syntheticPacketRaw from "../../examples/garpa-synthetic-observation/claim-packet.json";
import syntheticOutcomeRaw from "../../examples/garpa-synthetic-observation/mission-outcome.json";
import syntheticGraphRaw from "../../examples/garpa-synthetic-observation/capability-graph.json";
import vectusPacketRaw from "../../examples/garpa-vectus/claim-packet.json";
import vectusOutcomeRaw from "../../examples/garpa-vectus/mission-outcome.json";
import type {
  ClaimPacket,
  GarpaAdmissionResult,
  MissionOutcome,
} from "../../app/src/types/garpa";
import type { CapabilityGraph } from "../../app/src/types/garpaCapability";
import {
  validateClaimPacket,
  validateMissionOutcome,
} from "../../app/src/lib/garpa/validateClaimPacket";
import { runGarpaAdmission } from "../../app/src/lib/garpa/runGarpaAdmission";
import { validateCapabilityGraph } from "../../app/src/lib/garpa/validateCapabilityGraph";
import { runCapabilityGraphGate } from "../../app/src/lib/garpa/runCapabilityGraphGate";

const SYNTHETIC_DIGEST = "sha256:synthetic-observation-mission-v1";

interface ValidatedCase {
  packet: ClaimPacket;
  outcome: MissionOutcome;
  admission: GarpaAdmissionResult;
  graph: CapabilityGraph;
}

function validatedSynthetic(): ValidatedCase {
  const packet = validateClaimPacket(syntheticPacketRaw);
  expect(packet.ok, packet.errors.join("; ")).toBe(true);
  const outcome = validateMissionOutcome(syntheticOutcomeRaw, packet.value);
  expect(outcome.ok, outcome.errors.join("; ")).toBe(true);
  const graph = validateCapabilityGraph(
    syntheticGraphRaw,
    packet.value,
    outcome.value,
  );
  expect(graph.ok, graph.errors.join("; ")).toBe(true);
  const admission = runGarpaAdmission(packet.value!, outcome.value!);
  expect(admission.passed).toBe(true);
  return {
    packet: packet.value!,
    outcome: outcome.value!,
    admission,
    graph: graph.value!,
  };
}

function validatedVectus(): {
  packet: ClaimPacket;
  outcome: MissionOutcome;
  admission: GarpaAdmissionResult;
} {
  const packet = validateClaimPacket(vectusPacketRaw);
  expect(packet.ok, packet.errors.join("; ")).toBe(true);
  const outcome = validateMissionOutcome(vectusOutcomeRaw, packet.value);
  expect(outcome.ok, outcome.errors.join("; ")).toBe(true);
  const admission = runGarpaAdmission(packet.value!, outcome.value!);
  expect(admission.passed).toBe(false);
  return { packet: packet.value!, outcome: outcome.value!, admission };
}

describe("GARPA capability-graph validation", () => {
  it("accepts the source-addressable synthetic graph", () => {
    const { packet, outcome } = validatedSynthetic();
    const result = validateCapabilityGraph(syntheticGraphRaw, packet, outcome);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects unresolved function and interface references", () => {
    const { packet, outcome, graph } = validatedSynthetic();
    const broken = structuredClone(graph);
    broken.functions[0]!.outputInterfaceIds = ["ghost-interface"];
    broken.interfaces[0]!.consumerFunctionIds = ["ghost-function"];
    const result = validateCapabilityGraph(broken, packet, outcome);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("unknown interface");
    expect(result.errors.join(" ")).toContain("unknown function");
  });
});

describe("GARPA capability-graph gate", () => {
  it("admits a complete implementation-neutral graph for substitution research", () => {
    const { outcome, admission, graph } = validatedSynthetic();
    const result = runCapabilityGraphGate(
      graph,
      outcome,
      admission,
      SYNTHETIC_DIGEST,
    );
    expect(result.passed).toBe(true);
    expect(result.state).toBe("admitted_for_substitution");
    expect(result.pullList).toEqual([]);
  });

  it("refuses decomposition when the upstream GARPA goal remains blocked", () => {
    const { outcome, admission } = validatedVectus();
    const { graph } = validatedSynthetic();
    const result = runCapabilityGraphGate(
      graph,
      outcome,
      admission,
      graph.missionOutcomeDigest,
    );
    expect(result.passed).toBe(false);
    expect(result.state).toBe("goal_not_admitted");
  });

  it("invalidates a graph built against a stale mission outcome", () => {
    const { outcome, admission, graph } = validatedSynthetic();
    const result = runCapabilityGraphGate(
      graph,
      outcome,
      admission,
      "sha256:new-mission",
    );
    expect(result.state).toBe("mission_digest_mismatch");
  });

  it("blocks an uncovered mission metric", () => {
    const { outcome, admission, graph } = validatedSynthetic();
    const broken = structuredClone(graph);
    broken.traces = broken.traces.filter(
      (trace) => trace.requirementKey !== "metric:m1",
    );
    const result = runCapabilityGraphGate(
      broken,
      outcome,
      admission,
      SYNTHETIC_DIGEST,
    );
    expect(result.state).toBe("mission_trace_incomplete");
    expect(result.uncoveredRequirementKeys).toContain("metric:m1");
  });

  it("blocks a dangling terminal interface", () => {
    const { outcome, admission, graph } = validatedSynthetic();
    const broken = structuredClone(graph);
    const alert = broken.interfaces.find((edge) => edge.id === "i-alert")!;
    delete alert.terminalPurpose;
    const result = runCapabilityGraphGate(
      broken,
      outcome,
      admission,
      SYNTHETIC_DIGEST,
    );
    expect(result.state).toBe("interface_graph_incomplete");
    expect(result.danglingInterfaceIds).toContain("i-alert");
  });

  it("blocks a human-in-the-loop function without a reciprocal role", () => {
    const { outcome, admission, graph } = validatedSynthetic();
    const broken = structuredClone(graph);
    broken.functions.find((fn) => fn.id === "f-present")!.humanRoleIds = [];
    const result = runCapabilityGraphGate(
      broken,
      outcome,
      admission,
      SYNTHETIC_DIGEST,
    );
    expect(result.state).toBe("human_role_missing");
    expect(result.missingHumanRoleFunctionIds).toContain("f-present");
  });

  it("blocks unresolved constraint sets", () => {
    const { outcome, admission, graph } = validatedSynthetic();
    const broken = structuredClone(graph);
    broken.constraintEnvelope.economic = {
      state: "unresolved",
      items: [],
    };
    const result = runCapabilityGraphGate(
      broken,
      outcome,
      admission,
      SYNTHETIC_DIGEST,
    );
    expect(result.state).toBe("constraint_envelope_incomplete");
    expect(result.incompleteConstraintSets).toContain("economic");
  });

  it("blocks a required vendor-specific function", () => {
    const { outcome, admission, graph } = validatedSynthetic();
    const broken = structuredClone(graph);
    const detect = broken.functions.find((fn) => fn.id === "f-detect")!;
    detect.origin = "vendor_specific";
    const result = runCapabilityGraphGate(
      broken,
      outcome,
      admission,
      SYNTHETIC_DIGEST,
    );
    expect(result.state).toBe("vendor_architecture_leakage");
    expect(result.vendorLeakageFunctionIds).toContain("f-detect");
  });

  it("blocks a missing authorization boundary when the function requires one", () => {
    const { outcome, admission, graph } = validatedSynthetic();
    const broken = structuredClone(graph);
    const detect = broken.functions.find((fn) => fn.id === "f-detect")!;
    detect.requiresAuthorizationBoundary = true;
    delete detect.authorizationBoundary;
    const result = runCapabilityGraphGate(
      broken,
      outcome,
      admission,
      SYNTHETIC_DIGEST,
    );
    expect(result.state).toBe("authorization_boundary_missing");
    expect(result.missingAuthorizationFunctionIds).toContain("f-detect");
  });
});
