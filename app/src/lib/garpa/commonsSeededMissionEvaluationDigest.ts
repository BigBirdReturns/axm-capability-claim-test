import type {
  CommonsSeededMissionEvaluationEnvelope,
  CommonsSeededMissionEvaluationResult,
} from "../../types/garpaCommonsSeededMissionEvaluation";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

export function computeCommonsSeededMissionEvaluationEnvelopeDigest(
  envelope: CommonsSeededMissionEvaluationEnvelope,
): string {
  const { envelopeDigest: _ignored, ...content } = envelope;
  return sha256Hex(canonicalStringify(content));
}

export function computeCommonsSeededMissionEvaluationResultDigest(
  result: CommonsSeededMissionEvaluationResult,
): string {
  return sha256Hex(canonicalStringify(result));
}
