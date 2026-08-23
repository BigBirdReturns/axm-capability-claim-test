import type {
  CommonsCompatibilityAdmissionReceipt,
  CommonsCompatibilityAdmissionReceiptContent,
} from "../../types/garpaCommonsProjection";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

export function computeCompatibilityAdmissionReceiptDigest(
  content: CommonsCompatibilityAdmissionReceiptContent,
): string {
  return sha256Hex(canonicalStringify(content));
}

export function verifyCompatibilityAdmissionReceipt(
  receipt: CommonsCompatibilityAdmissionReceipt,
): boolean {
  const { receiptDigest, ...content } = receipt;
  return receiptDigest === computeCompatibilityAdmissionReceiptDigest(content);
}
