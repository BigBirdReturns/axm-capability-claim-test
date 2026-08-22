import type { GarpaAdmissionResult } from "../../types/garpa";
import { runSourcingGate } from "../runSourcingGate";
import { compileOfferingLedger } from "./compileOfferingLedger";
import { runGoalGate } from "./runGoalGate";
import { runOfferingEvidenceGate } from "./runOfferingEvidenceGate";
import { validateClaimPacket } from "./validateClaimPacket";
import { validateMissionOutcome } from "./validateMissionOutcome";

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function runGarpaAdmission(
  claimPacketInput: unknown,
  missionOutcomeInput?: unknown,
): GarpaAdmissionResult {
  const packetResult = validateClaimPacket(claimPacketInput);
  if (!packetResult.ok || !packetResult.claimPacket) {
    return {
      ok: false,
      admittedThrough: "invalid",
      errors: packetResult.errors,
    };
  }

  const claimPacket = packetResult.claimPacket;
  const ledger = compileOfferingLedger(claimPacket);
  const sourcingGate = runSourcingGate(ledger);
  const offeringEvidenceGate = runOfferingEvidenceGate(claimPacket);

  if (missionOutcomeInput === undefined) {
    return {
      ok: true,
      admittedThrough: "claim_packet",
      architectureReady: false,
      claimPacket,
      ledger,
      sourcingGate,
      offeringEvidenceGate,
      blockingReasons: unique([
        ...offeringEvidenceGate.blockingReasons,
        "Mission outcome proposal missing.",
      ]),
      pullList: unique([
        ...offeringEvidenceGate.pullList,
        "Produce an evidence-bound mission outcome proposal before functional decomposition.",
      ]),
    };
  }

  const missionResult = validateMissionOutcome(missionOutcomeInput, claimPacket);
  if (!missionResult.ok || !missionResult.missionOutcome) {
    return {
      ok: false,
      admittedThrough: "invalid",
      errors: missionResult.errors.map((error) => `missionOutcome: ${error}`),
    };
  }

  const missionOutcome = missionResult.missionOutcome;
  const goalGate = runGoalGate(missionOutcome);
  const architectureReady =
    sourcingGate.passed &&
    offeringEvidenceGate.architecturePreconditionsPassed &&
    goalGate.passed;

  const sourcingReasons = sourcingGate.passed
    ? []
    : [
        `Capability Claim Test sourcing gate blocked: ${sourcingGate.sourcedCount}/${sourcingGate.required} load-bearing fields sourced.`,
      ];
  const sourcingPulls = sourcingGate.passed
    ? []
    : sourcingGate.missing.map(
        (field) =>
          `Retrieve external evidence for offering field ${field.field} (${field.label}).`,
      );

  return {
    ok: true,
    admittedThrough: architectureReady
      ? "architecture"
      : offeringEvidenceGate.passed
        ? "goal_hypothesis"
        : "claim_packet",
    architectureReady,
    claimPacket,
    ledger,
    sourcingGate,
    offeringEvidenceGate,
    missionOutcome,
    goalGate,
    blockingReasons: unique([
      ...sourcingReasons,
      ...offeringEvidenceGate.blockingReasons,
      ...goalGate.blockingReasons,
    ]),
    pullList: unique([
      ...sourcingPulls,
      ...offeringEvidenceGate.pullList,
      ...goalGate.pullList,
    ]),
  };
}
