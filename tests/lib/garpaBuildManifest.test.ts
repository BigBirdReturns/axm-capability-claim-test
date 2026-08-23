import { describe, expect, it } from "vitest";
import packetRaw from "../../examples/garpa-synthetic-observation/claim-packet.json";
import outcomeRaw from "../../examples/garpa-synthetic-observation/mission-outcome.json";
import graphRaw from "../../examples/garpa-synthetic-observation/capability-graph.json";
import planRaw from "../../examples/garpa-synthetic-observation/substitution-plan.json";
import architectureRaw from "../../examples/garpa-synthetic-observation/candidate-architecture.json";
import qualificationRaw from "../../examples/garpa-synthetic-observation/qualification-contract.json";
import manifestRaw from "../../examples/garpa-synthetic-observation/build-manifest.json";
import type { ClaimPacket, MissionOutcome } from "../../app/src/types/garpa";
import type { CapabilityGraph } from "../../app/src/types/garpaCapability";
import type { SubstitutionPlan } from "../../app/src/types/garpaSubstitution";
import type { CandidateArchitecture } from "../../app/src/types/garpaArchitecture";
import type {
  QualificationContract,
  QualificationGateResult,
} from "../../app/src/types/garpaQualification";
import type { BuildManifest } from "../../app/src/types/garpaBuild";
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
import { validateBuildManifest } from "../../app/src/lib/garpa/validateBuildManifest";
import { runBuildManifestGate } from "../../app/src/lib/garpa/runBuildManifestGate";

const MISSION_DIGEST = "sha256:synthetic-observation-mission-v1";
const GRAPH_DIGEST = "sha256:synthetic-observation-graph-v1";
const SUBSTITUTION_DIGEST = "sha256:synthetic-observation-substitution-v1";
const ARCHITECTURE_DIGEST = "sha256:synthetic-observation-architecture-v1";
const QUALIFICATION_DIGEST = "sha256:synthetic-observation-qualification-v1";

interface Fixture {
  packet: ClaimPacket;
  outcome: MissionOutcome;
  graph: CapabilityGraph;
  plan: SubstitutionPlan;
  architecture: CandidateArchitecture;
  qualification: QualificationContract;
  qualificationGate: QualificationGateResult;
  manifest: BuildManifest;
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
  const manifest = validateBuildManifest(
    manifestRaw,
    architecture.value!,
    plan.value!,
    qualification.value!,
  );
  expect(manifest.ok, manifest.errors.join("; ")).toBe(true);

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
  const qualificationGate = runQualificationGate(
    qualification.value!,
    outcome.value!,
    architecture.value!,
    architectureGate,
    ARCHITECTURE_DIGEST,
  );
  expect(qualificationGate.passed, qualificationGate.pullList.join("; ")).toBe(
    true,
  );

  return {
    packet: packet.value!,
    outcome: outcome.value!,
    graph: graph.value!,
    plan: plan.value!,
    architecture: architecture.value!,
    qualification: qualification.value!,
    qualificationGate,
    manifest: manifest.value!,
  };
}

describe("GARPA build-manifest validation", () => {
  it("accepts the frozen synthetic build manifest", () => {
    const { architecture, plan, qualification } = fixture();
    const result = validateBuildManifest(
      manifestRaw,
      architecture,
      plan,
      qualification,
    );
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects unresolved component and predecessor references", () => {
    const { architecture, plan, qualification, manifest } = fixture();
    const broken = structuredClone(manifest);
    broken.components[0]!.componentId = "ghost-component";
    broken.assemblySteps[0]!.predecessorIds = ["ghost-step"];
    const result = validateBuildManifest(
      broken,
      architecture,
      plan,
      qualification,
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("unknown component");
    expect(result.errors.join(" ")).toContain("unknown assembly predecessor");
  });
});

describe("GARPA build-manifest gate", () => {
  it("admits the frozen manifest for controlled assembly", () => {
    const { architecture, plan, qualification, qualificationGate, manifest } =
      fixture();
    const result = runBuildManifestGate(
      manifest,
      architecture,
      plan,
      qualification,
      qualificationGate,
      QUALIFICATION_DIGEST,
    );
    expect(result.passed, result.pullList.join("; ")).toBe(true);
    expect(result.state).toBe("admitted_for_assembly");
  });

  it("refuses a manifest when qualification is not admitted", () => {
    const { architecture, plan, qualification, qualificationGate, manifest } =
      fixture();
    const blocked: QualificationGateResult = {
      ...qualificationGate,
      passed: false,
      state: "acceptance_rule_invalid",
    };
    const result = runBuildManifestGate(
      manifest,
      architecture,
      plan,
      qualification,
      blocked,
      QUALIFICATION_DIGEST,
    );
    expect(result.state).toBe("qualification_not_admitted");
  });

  it("invalidates a manifest built against stale qualification", () => {
    const { architecture, plan, qualification, qualificationGate, manifest } =
      fixture();
    const result = runBuildManifestGate(
      manifest,
      architecture,
      plan,
      qualification,
      qualificationGate,
      "sha256:new-qualification",
    );
    expect(result.state).toBe("upstream_digest_mismatch");
  });

  it("blocks an exact-version or quantity mismatch", () => {
    const { architecture, plan, qualification, qualificationGate, manifest } =
      fixture();
    const broken = structuredClone(manifest);
    broken.components[0]!.exactModelOrVersion = "sensor-v2";
    broken.components[0]!.quantity = 2;
    const result = runBuildManifestGate(
      broken,
      architecture,
      plan,
      qualification,
      qualificationGate,
      QUALIFICATION_DIGEST,
    );
    expect(result.state).toBe("component_manifest_incomplete");
    expect(result.componentFindings.join(" ")).toContain("sensor-v1");
    expect(result.componentFindings.join(" ")).toContain("quantity");
  });

  it("blocks a missing compatibility edge or human role", () => {
    const { architecture, plan, qualification, qualificationGate, manifest } =
      fixture();
    const noEdge = structuredClone(manifest);
    noEdge.compatibilityEdges = noEdge.compatibilityEdges.filter(
      (edge) => edge.compatibilityEdgeId !== "compat-observation",
    );
    const edgeResult = runBuildManifestGate(
      noEdge,
      architecture,
      plan,
      qualification,
      qualificationGate,
      QUALIFICATION_DIGEST,
    );
    expect(edgeResult.state).toBe("compatibility_manifest_incomplete");

    const noRole = structuredClone(manifest);
    noRole.humanRoles = [];
    const roleResult = runBuildManifestGate(
      noRole,
      architecture,
      plan,
      qualification,
      qualificationGate,
      QUALIFICATION_DIGEST,
    );
    expect(roleResult.state).toBe("human_role_manifest_incomplete");
  });

  it("blocks missing instrumentation and calibration custody", () => {
    const { architecture, plan, qualification, qualificationGate, manifest } =
      fixture();
    const noInstrument = structuredClone(manifest);
    noInstrument.instrumentation = noInstrument.instrumentation.filter(
      (instrument) =>
        instrument.instrumentationId !== "instrument-event-recorder",
    );
    const instrumentResult = runBuildManifestGate(
      noInstrument,
      architecture,
      plan,
      qualification,
      qualificationGate,
      QUALIFICATION_DIGEST,
    );
    expect(instrumentResult.state).toBe("instrumentation_manifest_incomplete");

    const noCalibration = structuredClone(manifest);
    noCalibration.calibrationPlan = noCalibration.calibrationPlan.filter(
      (item) => item.subjectId !== "component-sensor",
    );
    const calibrationResult = runBuildManifestGate(
      noCalibration,
      architecture,
      plan,
      qualification,
      qualificationGate,
      QUALIFICATION_DIGEST,
    );
    expect(calibrationResult.state).toBe("calibration_plan_incomplete");
    expect(calibrationResult.calibrationFindings.join(" ")).toContain(
      "component-sensor",
    );
  });

  it("blocks ungoverned substitutions and incomplete assembly coverage", () => {
    const { architecture, plan, qualification, qualificationGate, manifest } =
      fixture();
    const noPolicy = structuredClone(manifest);
    noPolicy.substitutionPolicies = noPolicy.substitutionPolicies.filter(
      (policy) => policy.componentId !== "component-ui",
    );
    const policyResult = runBuildManifestGate(
      noPolicy,
      architecture,
      plan,
      qualification,
      qualificationGate,
      QUALIFICATION_DIGEST,
    );
    expect(policyResult.state).toBe("substitution_policy_incomplete");

    const noAssemblyEdge = structuredClone(manifest);
    noAssemblyEdge.assemblySteps.forEach((step) => {
      step.compatibilityEdgeIds = step.compatibilityEdgeIds.filter(
        (id) => id !== "compat-detection",
      );
    });
    const assemblyResult = runBuildManifestGate(
      noAssemblyEdge,
      architecture,
      plan,
      qualification,
      qualificationGate,
      QUALIFICATION_DIGEST,
    );
    expect(assemblyResult.state).toBe("assembly_plan_incomplete");
    expect(assemblyResult.assemblyFindings.join(" ")).toContain(
      "compat-detection",
    );
  });

  it("blocks missing architecture cost and schedule traces", () => {
    const { architecture, plan, qualification, qualificationGate, manifest } =
      fixture();
    const broken = structuredClone(manifest);
    broken.expectedCostLineIds = ["cost-hardware"];
    broken.expectedScheduleLineIds = ["schedule-procurement"];
    const result = runBuildManifestGate(
      broken,
      architecture,
      plan,
      qualification,
      qualificationGate,
      QUALIFICATION_DIGEST,
    );
    expect(result.state).toBe("cost_or_schedule_trace_incomplete");
    expect(result.missingCostLineIds).toContain("cost-integration");
    expect(result.missingScheduleLineIds).toContain("schedule-qualification");
  });

  it("requires the manifest to be frozen before assembly", () => {
    const { architecture, plan, qualification, qualificationGate, manifest } =
      fixture();
    const broken = structuredClone(manifest);
    broken.state = "candidate";
    const result = runBuildManifestGate(
      broken,
      architecture,
      plan,
      qualification,
      qualificationGate,
      QUALIFICATION_DIGEST,
    );
    expect(result.state).toBe("manifest_not_frozen");
  });
});
