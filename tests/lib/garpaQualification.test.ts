import { describe, expect, it } from "vitest";
import packetRaw from "../../examples/garpa-synthetic-observation/claim-packet.json";
import outcomeRaw from "../../examples/garpa-synthetic-observation/mission-outcome.json";
import graphRaw from "../../examples/garpa-synthetic-observation/capability-graph.json";
import planRaw from "../../examples/garpa-synthetic-observation/substitution-plan.json";
import architectureRaw from "../../examples/garpa-synthetic-observation/candidate-architecture.json";
import qualificationRaw from "../../examples/garpa-synthetic-observation/qualification-contract.json";
import type { ClaimPacket, MissionOutcome } from "../../app/src/types/garpa";
import type { CapabilityGraph } from "../../app/src/types/garpaCapability";
import type { SubstitutionPlan } from "../../app/src/types/garpaSubstitution";
import type {
  ArchitectureGateResult,
  CandidateArchitecture,
} from "../../app/src/types/garpaArchitecture";
import type { QualificationContract } from "../../app/src/types/garpaQualification";
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
import { validateQualificationContract } from "../../app/src/lib/garpa/validateQualificationContract";
import { runQualificationGate } from "../../app/src/lib/garpa/runQualificationGate";

const MISSION_DIGEST = "sha256:synthetic-observation-mission-v1";
const GRAPH_DIGEST = "sha256:synthetic-observation-graph-v1";
const SUBSTITUTION_DIGEST = "sha256:synthetic-observation-substitution-v1";
const ARCHITECTURE_DIGEST = "sha256:synthetic-observation-architecture-v1";

interface Fixture {
  packet: ClaimPacket;
  outcome: MissionOutcome;
  graph: CapabilityGraph;
  plan: SubstitutionPlan;
  architecture: CandidateArchitecture;
  architectureGate: ArchitectureGateResult;
  qualification: QualificationContract;
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
  const qualification = validateQualificationContract(
    qualificationRaw,
    outcome.value!,
    architecture.value!,
    packet.value!,
  );
  expect(qualification.ok, qualification.errors.join("; ")).toBe(true);

  const admission = runGarpaAdmission(packet.value!, outcome.value!);
  const graphGate = runCapabilityGraphGate(
    graph.value!,
    outcome.value!,
    admission,
    MISSION_DIGEST,
  );
  const substitutionGate = runSubstitutionGate(
    plan.value!,
    graph.value!,
    graphGate,
    GRAPH_DIGEST,
    packet.value!,
  );
  const architectureGate = runArchitectureGate(
    architecture.value!,
    graph.value!,
    plan.value!,
    substitutionGate,
    SUBSTITUTION_DIGEST,
  );
  expect(architectureGate.passed, architectureGate.pullList.join("; ")).toBe(true);

  return {
    packet: packet.value!,
    outcome: outcome.value!,
    graph: graph.value!,
    plan: plan.value!,
    architecture: architecture.value!,
    architectureGate,
    qualification: qualification.value!,
  };
}

describe("GARPA qualification-contract validation", () => {
  it("accepts the frozen synthetic qualification contract", () => {
    const { packet, outcome, architecture } = fixture();
    const result = validateQualificationContract(
      qualificationRaw,
      outcome,
      architecture,
      packet,
    );
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects unresolved metric and instrumentation references", () => {
    const { packet, outcome, architecture, qualification } = fixture();
    const broken = structuredClone(qualification);
    broken.scenarios[0]!.metricIds = ["ghost-metric"];
    broken.metrics[0]!.instrumentationIds = ["ghost-instrument"];
    const result = validateQualificationContract(
      broken,
      outcome,
      architecture,
      packet,
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("unknown metric");
    expect(result.errors.join(" ")).toContain("unknown instrumentation");
  });
});

describe("GARPA qualification gate", () => {
  it("admits the frozen contract for build-manifest work", () => {
    const { outcome, architecture, architectureGate, qualification } = fixture();
    const result = runQualificationGate(
      qualification,
      outcome,
      architecture,
      architectureGate,
      ARCHITECTURE_DIGEST,
    );
    expect(result.passed, result.pullList.join("; ")).toBe(true);
    expect(result.state).toBe("admitted_for_build_manifest");
  });

  it("refuses qualification when the architecture is not admitted", () => {
    const { outcome, architecture, architectureGate, qualification } = fixture();
    const blocked: ArchitectureGateResult = {
      ...architectureGate,
      passed: false,
      state: "cost_envelope_incomplete",
    };
    const result = runQualificationGate(
      qualification,
      outcome,
      architecture,
      blocked,
      ARCHITECTURE_DIGEST,
    );
    expect(result.state).toBe("architecture_not_admitted");
  });

  it("invalidates a contract built against a stale architecture", () => {
    const { outcome, architecture, architectureGate, qualification } = fixture();
    const result = runQualificationGate(
      qualification,
      outcome,
      architecture,
      architectureGate,
      "sha256:new-architecture",
    );
    expect(result.state).toBe("upstream_digest_mismatch");
  });

  it("blocks an uncovered mission metric", () => {
    const { outcome, architecture, architectureGate, qualification } = fixture();
    const broken = structuredClone(qualification);
    broken.metrics = broken.metrics.filter((metric) => metric.id !== "q-detection");
    broken.scenarios[0]!.metricIds = ["q-latency"];
    broken.comparators[0]!.metricIds = ["q-latency"];
    const result = runQualificationGate(
      broken,
      outcome,
      architecture,
      architectureGate,
      ARCHITECTURE_DIGEST,
    );
    expect(result.state).toBe("mission_metric_coverage_incomplete");
    expect(result.uncoveredMissionMetricIds).toContain("m1");
  });

  it("blocks a threshold or baseline that drifts from the mission outcome", () => {
    const { outcome, architecture, architectureGate, qualification } = fixture();
    const broken = structuredClone(qualification);
    broken.metrics.find((metric) => metric.id === "q-latency")!.threshold = 5;
    const result = runQualificationGate(
      broken,
      outcome,
      architecture,
      architectureGate,
      ARCHITECTURE_DIGEST,
    );
    expect(result.state).toBe("threshold_or_baseline_mismatch");
    expect(result.thresholdFindings.join(" ")).toContain("m2");
  });

  it("blocks instrumentation with unresolved calibration", () => {
    const { outcome, architecture, architectureGate, qualification } = fixture();
    const broken = structuredClone(qualification);
    broken.instrumentation[0]!.calibrationState = "unknown";
    const result = runQualificationGate(
      broken,
      outcome,
      architecture,
      architectureGate,
      ARCHITECTURE_DIGEST,
    );
    expect(result.state).toBe("instrumentation_incomplete");
    expect(result.instrumentationFindings.join(" ")).toContain("instrument-run-clock");
  });

  it("blocks architecture risk tests that the qualification contract omits", () => {
    const { outcome, architecture, architectureGate, qualification } = fixture();
    const changedArchitecture = structuredClone(architecture);
    changedArchitecture.risks[0]!.qualificationTestIds = ["q-missing"];
    const result = runQualificationGate(
      qualification,
      outcome,
      changedArchitecture,
      architectureGate,
      ARCHITECTURE_DIGEST,
    );
    expect(result.state).toBe("risk_or_residual_test_missing");
    expect(result.missingRiskTestIds).toContain("q-missing");
  });

  it("requires a same-fixture customer-requirement comparator", () => {
    const { outcome, architecture, architectureGate, qualification } = fixture();
    const broken = structuredClone(qualification);
    broken.comparators = [];
    const result = runQualificationGate(
      broken,
      outcome,
      architecture,
      architectureGate,
      ARCHITECTURE_DIGEST,
    );
    expect(result.state).toBe("comparator_incomplete");
  });

  it("blocks an accounting boundary that drops architecture costs", () => {
    const { outcome, architecture, architectureGate, qualification } = fixture();
    const broken = structuredClone(qualification);
    broken.accountingBoundary.includedCategories = ["hardware", "software"];
    const result = runQualificationGate(
      broken,
      outcome,
      architecture,
      architectureGate,
      ARCHITECTURE_DIGEST,
    );
    expect(result.state).toBe("accounting_boundary_mismatch");
    expect(result.accountingFindings.join(" ")).toContain("integration_labor");
  });

  it("blocks active or field scenarios without admitted authority", () => {
    const { outcome, architecture, architectureGate, qualification } = fixture();
    const broken = structuredClone(qualification);
    broken.scenarios[0]!.activeEffect = true;
    const result = runQualificationGate(
      broken,
      outcome,
      architecture,
      architectureGate,
      ARCHITECTURE_DIGEST,
    );
    expect(result.state).toBe("authorization_missing");
  });

  it("blocks compensatory or permissive essential-metric rules", () => {
    const { outcome, architecture, architectureGate, qualification } = fixture();
    const broken = structuredClone(qualification);
    broken.acceptanceRule.allEssentialMustPass = false;
    broken.acceptanceRule.secondaryMetricsCanOffsetEssentialFailure = true;
    const result = runQualificationGate(
      broken,
      outcome,
      architecture,
      architectureGate,
      ARCHITECTURE_DIGEST,
    );
    expect(result.state).toBe("acceptance_rule_invalid");
  });

  it("requires the qualification contract to be frozen", () => {
    const { outcome, architecture, architectureGate, qualification } = fixture();
    const broken = structuredClone(qualification);
    broken.state = "candidate";
    const result = runQualificationGate(
      broken,
      outcome,
      architecture,
      architectureGate,
      ARCHITECTURE_DIGEST,
    );
    expect(result.state).toBe("contract_not_frozen");
  });
});
