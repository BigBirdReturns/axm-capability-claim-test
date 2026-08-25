import type {
  CommonsSeededExternalPublicationEnvelope,
  CommonsSeededExternalPublicationResult,
} from "../../types/garpaCommonsSeededExternalPublication";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

export function computeCommonsSeededExternalPublicationEnvelopeDigest(
  envelope: CommonsSeededExternalPublicationEnvelope,
): string {
  const { envelopeDigest: _ignored, ...content } = envelope;
  return sha256Hex(canonicalStringify(content));
}

export function computeCommonsSeededExternalPublicationResultDigest(
  result: CommonsSeededExternalPublicationResult,
): string {
  return sha256Hex(canonicalStringify(result));
}
