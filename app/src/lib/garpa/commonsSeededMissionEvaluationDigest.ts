import type {
  CommonsSeededMissionEvaluationEnvelope,
  CommonsSeededMissionEvaluationResult,
  CommonsSeededMissionRunBinding,
} from "../../types/garpaCommonsSeededMissionEvaluation";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

function canonicalRunBindings(
  bindings: CommonsSeededMissionRunBinding[],
): CommonsSeededMissionRunBinding[] {
  return [...bindings]
    .map((binding) => ({ ...binding }))
    .sort((left, right) => left.runId.localeCompare(right.runId));
}

export function computeCommonsSeededMissionRunSetDigest(
  bindings: CommonsSeededMissionRunBinding[],
): string {
  return sha256Hex(canonicalStringify(canonicalRunBindings(bindings)));
}

export function computeCommonsSeededMissionEvaluationEnvelopeDigest(
  envelope: CommonsSeededMissionEvaluationEnvelope,
): string {
  const { envelopeDigest: _ignored, ...content } = envelope;
  return sha256Hex(
    canonicalStringify({
      ...content,
      runBindings: canonicalRunBindings(content.runBindings),
    }),
  );
}

export function computeCommonsSeededMissionEvaluationResultDigest(
  result: CommonsSeededMissionEvaluationResult,
): string {
  return sha256Hex(canonicalStringify(result));
}
