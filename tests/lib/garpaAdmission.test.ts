import { describe, expect, it } from "vitest";
import vectusPacketRaw from "../../examples/garpa-vectus/claim-packet.json";
import vectusOutcomeRaw from "../../examples/garpa-vectus/mission-outcome.json";
import type { ClaimPacket, MissionOutcome } from "../../app/src/types/garpa";
import {
  validateClaimPacket,
  validateMissionOutcome,
} from "../../app/src/lib/garpa/validateClaimPacket";
import { runOfferingEvidenceGate } from "../../app/src/lib/garpa/runOfferingEvidenceGate";
import { runGoalGate } from "../../app/src/lib/garpa/runGoalGate";
import { runGarpaAdmission } from "../../app/src/lib/garpa/runGarpaAdmission";
import { renderGarpaRealityBrief } from "../../app/src/lib/garpa/renderRealityBrief";

function validatedVectus(): { packet: ClaimPacket; outcome: MissionOutcome } {
  const packet = validateClaimPacket(vectusPacketRaw);
  expect(packet.ok, packet.errors.join("; ")).toBe(true);
  const outcome = validateMissionOutcome(vectusOutcomeRaw, packet.value);
  expect(outcome.ok, outcome.errors.join("; ")).toBe(true);
  return { packet: packet.value!, outcome: outcome.value! };
}

function packetWithGoalEvidence(packet: ClaimPacket): ClaimPacket {
  const copy = structuredClone(packet);
  copy.evidence.push(
    {
      id: "goal-environment",
      target: "operating_environment",
      venue: "customer_publication",
      control: "externally_attributed",
      locator: { artifactId: copy.artifacts[0]!.id, description: "Controlled outdoor site." },
      scopeCompleteness: "complete",
      supports: [],
      limitations: [],
    },
    {
      id: "goal-requirement",
      target: "operator_need",
      venue: "customer_publication",
      control: "externally_attributed",
      locator: { artifactId: copy.artifacts[0]!.id, description: "One-hour detection requirement." },
      scopeCompleteness: "complete",
      supports: [],
      limitations: [],
    },
  );
  return copy;
}

function passingOutcome(): MissionOutcome {
  const claimEvidence = ["e2"];
  const value = (text: string, evidenceCellIds: string[] = claimEvidence) => ({
    value: text,
    basis: "derived" as const,
    evidenceCellIds,
    limitations: [],
  });
  return {
    schemaVersion: 1,
    operator: value("Site operator"),
    protectedOrAffectedObject: value("Protected site"),
    problemOrThreat: value("Unauthorized object entry"),
    desiredStateChange: value("Detect and notify before boundary crossing"),
    operatingEnvironment: {
      ...value("Controlled outdoor site", ["goal-environment"]),
      basis: "externally_supported",
    },
    timeAndCoverageRequirement: {
      ...value("Continuous coverage during a one-hour test window", ["goal-requirement"]),
      basis: "externally_supported",
    },
    successMetrics: [
      {
        id: "m1",
        name: "Detection before boundary crossing",
        comparator: "boolean",
        threshold: true,
        baseline: false,
        basis: "externally_supported",
        evidenceCellIds: ["goal-requirement"],
        limitations: [],
      },
    ],
    exclusions: [],
  };
}

describe("GARPA claim-packet validation", () => {
  it("accepts the versioned, source-addressable packet shape", () => {
    const result = validateClaimPacket(vectusPacketRaw);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects duplicate ids and unresolved references", () => {
    const raw = structuredClone(vectusPacketRaw);
    raw.artifacts.push({ ...raw.artifacts[0]! });
    raw.claims[0]!.evidenceCellIds = ["ghost"];
    const result = validateClaimPacket(raw);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("duplicate id");
    expect(result.errors.join(" ")).toContain("unknown evidence");
  });

  it("requires fixture and method for local-result evidence", () => {
    const raw = structuredClone(vectusPacketRaw);
    raw.evidence[0]!.target = "local_result";
    raw.evidence[0]!.control = "local_measured";
    raw.evidence[0]!.venue = "local_reproduction";
    const result = validateClaimPacket(raw);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("requires a fixture");
    expect(result.errors.join(" ")).toContain("requires a method");
  });
});

describe("GARPA offering evidence gate", () => {
  it("does not turn a claimant cost statement into an observed economic baseline", () => {
    const { packet } = validatedVectus();
    const result = runOfferingEvidenceGate(packet);
    expect(result.claimedOnlyFields).toContain("economic_baseline");
    expect(result.disqualifiedCells.some((finding) => finding.evidenceCellId === "e4")).toBe(true);
  });

  it("blocks the fixture on unresolved version before decomposition", () => {
    const { packet } = validatedVectus();
    const result = runOfferingEvidenceGate(packet);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("version_unresolved");
    expect(result.missingFields).toContain("offering_version");
    expect(result.missingFields).toContain("operating_environment");
    expect(result.missingFields).toContain("system_boundary");
  });

  it("does not admit a partial system-boundary description as complete", () => {
    const { packet } = validatedVectus();
    const result = runOfferingEvidenceGate(packet);
    expect(result.admittedFields).not.toContain("system_boundary");
    expect(result.missingFields).toContain("system_boundary");
  });

  it("does not accept a model-supplied version without source-bound version evidence", () => {
    const { packet } = validatedVectus();
    packet.subject.offeringVersion = "1.0";
    const result = runOfferingEvidenceGate(packet);
    expect(result.admittedFields).not.toContain("offering_version");
    expect(result.missingFields).toContain("offering_version");
  });
});

describe("GARPA goal gate", () => {
  it("blocks prose goals without environment, coverage, metrics, or baseline", () => {
    const { packet, outcome } = validatedVectus();
    const result = runGoalGate(outcome, packet);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("goal_ambiguous");
    expect(result.missingFields).toContain("operating_environment");
    expect(result.missingFields).toContain("time_and_coverage_requirement");
    expect(result.missingFields).toContain("success_metrics");
  });

  it("admits a fully sourced, falsifiable mission outcome", () => {
    const { packet } = validatedVectus();
    const enriched = packetWithGoalEvidence(packet);
    const result = runGoalGate(passingOutcome(), enriched);
    expect(result.passed).toBe(true);
    expect(result.state).toBe("admitted_for_decomposition");
  });

  it("does not let claimant-controlled evidence masquerade as externally supported", () => {
    const { packet, outcome } = validatedVectus();
    outcome.operator.basis = "externally_supported";
    const result = runGoalGate(outcome, packet);
    expect(result.admittedFields).not.toContain("operator");
    expect(result.missingFields).toContain("operator");
  });

  it("rejects numeric thresholds that omit the measured unit", () => {
    const { packet } = validatedVectus();
    const enriched = packetWithGoalEvidence(packet);
    const outcome = passingOutcome();
    outcome.successMetrics[0] = {
      ...outcome.successMetrics[0]!,
      comparator: "lte",
      threshold: 2,
      baseline: 10,
      unit: undefined,
    };
    const result = runGoalGate(outcome, enriched);
    expect(result.passed).toBe(false);
    expect(result.rejectedMetricIds).toContain("m1");
  });

  it("rejects vague marketing language as a success metric", () => {
    const { packet } = validatedVectus();
    const enriched = packetWithGoalEvidence(packet);
    const outcome = passingOutcome();
    outcome.successMetrics[0] = {
      ...outcome.successMetrics[0]!,
      name: "Effective high-performance protection",
      threshold: "effective",
    };
    const result = runGoalGate(outcome, enriched);
    expect(result.passed).toBe(false);
    expect(result.rejectedMetricIds).toContain("m1");
  });
});

describe("GARPA admission fixture", () => {
  it("returns the highest admissible state and no invented architecture", () => {
    const { packet, outcome } = validatedVectus();
    const result = runGarpaAdmission(packet, outcome);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("offering_blocked");
    expect(result.offeringGate.state).toBe("version_unresolved");
    expect(result.goalGate.state).toBe("goal_ambiguous");
    expect(result).not.toHaveProperty("architecture");
  });
});

describe("GARPA reality brief", () => {
  it("renders a bounded public-facing result from the admission receipts", () => {
    const { packet, outcome } = validatedVectus();
    const admission = runGarpaAdmission(packet, outcome);
    const brief = renderGarpaRealityBrief(packet, outcome, admission);
    expect(brief).toContain("# GARPA Reality Brief — Vectus Air Defense Systems");
    expect(brief).toContain("[claim only]");
    expect(brief).toContain("Architecture: not generated by the admission layer");
    expect(brief).toContain("Capability equivalence: not assessed");
    expect(brief).toContain("Exact offering version");
  });
});
