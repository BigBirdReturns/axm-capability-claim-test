import type { CommonsSeededSubstitutionResult } from "../../types/garpaCommonsSeededSubstitution";
import type { SubstitutionPlan } from "../../types/garpaSubstitution";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

export function computeCommonsSeededSubstitutionResultDigest(
  result: CommonsSeededSubstitutionResult,
): string {
  return sha256Hex(canonicalStringify(result));
}

export function computeTargetSubstitutionPlanDigest(
  plan: SubstitutionPlan,
): string {
  return sha256Hex(canonicalStringify(plan));
}
