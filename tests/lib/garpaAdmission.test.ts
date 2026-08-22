import { describe, expect, it } from "vitest";
import vectusPacketRaw from "../../examples/garpa-vectus/claim-packet.json";
import vectusMissionRaw from "../../examples/garpa-vectus/mission-outcome.json";
import { compileOfferingLedger } from "../../app/src/lib/garpa/compileOfferingLedger";
import { runGarpaAdmission } from "../../app/src/lib/garpa/runGarpaAdmission";
import { validateClaimPacket } from "../../app/src/lib/garpa/validateClaimPacket";
import { runObjectGate } from "../../app/src/lib/runObjectGate";
import type { ClaimPacket, MissionOutcome } from "../../app/src/types/garpa";

function vectusPacket(): ClaimPacket {
  const result = validateClaimPacket(vectusPacketRaw);
  expect(result.ok, result.errors.join("; ")).toBe(true);
  return structuredClone(result.claimPacket!);
}

function completeInputs(): { packet: ClaimPacket; mission: MissionOutcome } {
  const packet = vectusPacket();
  packet.subject.offeringVersion = "launch-state-2026-08-22";
  packet.artifacts.push({
    id: "artifact_operator_record",
    kind: "other",
    title: "Synthetic operator requirement and comparator fixture",
    publisher: "Synthetic regression authority",
    publishedAt: "2026-08-22",
    capturedAt: "2026-08-22",
    exactVersion: "fixture-v1",
    notes: "Synthetic passing fixture used only to prove the gates can admit a complete case.",
  });
  packet.evidence.push(
    {
      id: "e_version",
      target: "offering_version",
      venue: "claimant_publication",
      control: "claimant_controlled",
      locator: { artifactId: "artifact_vectus_launch_post", section: "capture state" },
      statement: "The evaluated offering state is fixed to the dated launch artifact.",
      subjectVersion: "launch-state-2026-08-22",
      limitations: [],
    },
    {
      id: "e_operator_need",
      target: "operator_need",
      venue: "government_record",
      control: "externally_attributed",
      locator: { artifactId: "artifact_operator_record", section: "mission requirement" },
      statement: "A fixed-site operator requires persistent awareness and bounded response decision support.",
      environment: "Controlled fixed-site test geometry",
      metric: "At least 90 percent of representative targets presented before the boundary",
      method: "Synthetic requirement fixture",
      limitations: ["Synthetic regression evidence, not a real Vectus record."],
    },
    {
      id: "e_environment",
      target: "system_boundary",
      venue: "government_record",
      control: "externally_attributed",
      locator: { artifactId: "artifact_operator_record", section: "environment" },
      statement: "The test boundary is a fixed site, one-hour window, defined geometry, and representative recorded targets.",
      environment: "Fixed controlled site",
      method: "Synthetic requirement fixture",
      limitations: ["Synthetic regression evidence."],
    },
    {
      id: "e_system_boundary",
      target: "system_boundary",
      venue: "government_record",
      control: "externally_attributed",
      locator: { artifactId: "artifact_operator_record", section: "system boundary" },
      statement: "The cost and architecture boundary includes equipment, software, communications, one operator, maintenance, and test support.",
      method: "Synthetic requirement fixture",
      limitations: ["Synthetic regression evidence."],
    },
    {
      id: "e_cost_baseline",
      target: "cost_observed",
      venue: "government_record",
      control: "externally_attributed",
      locator: { artifactId: "artifact_operator_record", section: "cost baseline" },
      statement: "The comparator is the current manual process at 100 cost units per protected hour under the same boundary.",
      metric: "cost per protected hour",
      method: "Synthetic requirement fixture",
      limitations: ["Synthetic regression evidence."],
    },
  );
  packet.claims.push(
    {
      id: "claim_version",
      field: "offering_version",
      target: "offering_version",
      statement: "The evaluated state is the dated launch configuration.",
      evidenceCellIds: ["e_version"],
      lifecycle: "active",
      limitations: [],
    },
    {
      id: "claim_operator_need",
      field: "named_operator_need",
      target: "operator_need",
      statement: "A fixed-site operator requires persistent awareness and response decision support.",
      evidenceCellIds: ["e_operator_need"],
      lifecycle: "active",
      limitations: [],
    },
    {
      id: "claim_environment",
      field: "operating_environment",
      target: "system_boundary",
      statement: "The admitted environment is a fixed controlled site with a one-hour window and defined geometry.",
      evidenceCellIds: ["e_environment"],
      lifecycle: "active",
      limitations: [],
    },
    {
      id: "claim_system_boundary",
      field: "system_boundary",
      target: "system_boundary",
      statement: "The system boundary includes equipment, software, communications, one operator, maintenance, and test support.",
      evidenceCellIds: ["e_system_boundary"],
      lifecycle: "active",
      limitations: [],
    },
    {
      id: "claim_cost_baseline",
      field: "economic_baseline",
      target: "cost_observed",
      statement: "The comparator costs 100 units per protected hour under the same boundary.",
      evidenceCellIds: ["e_cost_baseline"],
      lifecycle: "active",
      limitations: [],
    },
  );

  const mission = structuredClone(vectusMissionRaw) as unknown as MissionOutcome;
  mission.operator = {
    value: "A fixed-site protection operator",
    basis: "externally_supported",
    evidenceCellIds: ["e_operator_need"],
    limitations: [],
  };
  mission.operatingEnvironment = {
    value: "A controlled fixed site with defined geometry and representative recorded targets",
    basis: "externally_supported",
    evidenceCellIds: ["e_environment"],
    limitations: [],
  };
  mission.timeAndCoverageRequirement = {
    value: "One hour of continuous coverage inside the defined test boundary",
    basis: "externally_supported",
    evidenceCellIds: ["e_environment"],
    limitations: [],
  };
  mission.baseline = {
    value: "The current manual process at 100 cost units per protected hour",
    basis: "externally_supported",
    evidenceCellIds: ["e_cost_baseline"],
    limitations: [],
  };
  mission.successMetrics = [
    {
      id: "metric_target_presentation",
      name: "Representative targets presented before the protected boundary",
      unit: "proportion",
      comparator: "gte",
      threshold: 0.9,
      baseline: 0.5,
      basis: "externally_supported",
      evidenceCellIds: ["e_operator_need"],
      limitations: [],
    },
  ];

  return { packet, mission };
}

describe("GARPA admission", () => {
  it("validates the first Vectus claim packet", () => {
    const result = validateClaimPacket(vectusPacketRaw);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("compiles claimant language into an attribution-safe offering ledger", () => {
    const ledger = compileOfferingLedger(vectusPacket());
    expect(ledger.objectType).toBe("capability_offering");
    expect(runObjectGate(ledger).route).toBe("mission_outcome_replication");
    expect(
      ledger.claims.find((claim) => claim.field === "advertised_outcome")?.statement,
    ).toMatch(/^Swarmer states:/);
    expect(ledger.claims.some((claim) => claim.field === "measured_performance")).toBe(false);
  });

  it("admits the launch post only through a goal hypothesis and blocks architecture", () => {
    const result = runGarpaAdmission(vectusPacketRaw, vectusMissionRaw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The ordinary three-field sourcing gate opens because the post proves that
    // several advertised claims were made. The GARPA goal gate still refuses to
    // turn those statements into an engineering roadmap.
    expect(result.sourcingGate.passed).toBe(true);
    expect(result.admittedThrough).toBe("goal_hypothesis");
    expect(result.architectureReady).toBe(false);
    expect(result.offeringEvidenceGate.claimedOnlyFields).toContain("advertised_outcome");
    expect(result.blockingReasons.join(" ")).toContain("offering_version");
    expect(result.blockingReasons.join(" ")).toContain("operatingEnvironment");
    expect(result.blockingReasons.join(" ")).toContain("success metric");
  });

  it("rejects claimant-controlled prose presented as measured performance", () => {
    const packet = vectusPacket();
    packet.evidence.push({
      id: "e_bad_performance",
      target: "performance_observed",
      venue: "claimant_publication",
      control: "claimant_controlled",
      locator: { artifactId: "artifact_vectus_launch_post" },
      statement: "The claimant says the system is effective.",
      limitations: [],
    });
    packet.claims.push({
      id: "claim_bad_performance",
      field: "measured_performance",
      target: "performance_observed",
      statement: "The system is effective.",
      evidenceCellIds: ["e_bad_performance"],
      lifecycle: "active",
      limitations: [],
    });

    const result = validateClaimPacket(packet);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("none is admissible");
  });

  it("can admit a fully specified synthetic outcome for architecture", () => {
    const { packet, mission } = completeInputs();
    const result = runGarpaAdmission(packet, mission);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.offeringEvidenceGate.architecturePreconditionsPassed).toBe(true);
    expect(result.goalGate?.passed).toBe(true);
    expect(result.architectureReady).toBe(true);
    expect(result.admittedThrough).toBe("architecture");
  });
});
