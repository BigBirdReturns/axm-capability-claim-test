import type {
  ClaimPacket,
  GarpaAdmissionResult,
  MissionOutcome,
} from "../../types/garpa";
import { runOfferingEvidenceGate } from "./runOfferingEvidenceGate";
import { runGoalGate } from "./runGoalGate";

export function runGarpaAdmission(
  packet: ClaimPacket,
  outcome: MissionOutcome,
): GarpaAdmissionResult {
  const offeringGate = runOfferingEvidenceGate(packet);
  const goalGate = runGoalGate(outcome, packet);

  const state = !offeringGate.passed
    ? "offering_blocked"
    : !goalGate.passed
      ? "goal_blocked"
      : "admitted_for_decomposition";

  return {
    state,
    passed: state === "admitted_for_decomposition",
    offeringGate,
    goalGate,
    doctrine:
      "GARPA may propose a claim packet and mission outcome, but decomposition remains blocked until identity, version, environment, system boundary, and falsifiable goal fields are admitted. No architecture or equivalence claim exists at this stage.",
  };
}
