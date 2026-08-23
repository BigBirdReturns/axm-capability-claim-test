import type { MissionOutcome } from "../../types/garpa";
import type { ArchitectureComponentSelection, CandidateArchitecture } from "../../types/garpaArchitecture";
import type { CommonsSeededArchitectureResult } from "../../types/garpaCommonsSeededArchitecture";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

export function computeCommonsSeededArchitectureResultDigest(
  result: CommonsSeededArchitectureResult,
): string {
  return sha256Hex(canonicalStringify(result));
}

export function computeTargetMissionOutcomeDigest(
  outcome: MissionOutcome,
): string {
  return sha256Hex(canonicalStringify(outcome));
}

export function computeTargetCandidateArchitectureDigest(
  architecture: CandidateArchitecture,
): string {
  return sha256Hex(canonicalStringify(architecture));
}

export function computeArchitectureSelectionDigest(
  selection: ArchitectureComponentSelection,
): string {
  return sha256Hex(canonicalStringify(selection));
}
