import type {
  CommonsSeededPreflightReceipt,
  CommonsSeededPreflightResult,
} from "../../types/garpaCommonsSeededPreflight";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

export function computeCommonsSeededPreflightReceiptDigest(
  receipt: CommonsSeededPreflightReceipt,
): string {
  const { receiptDigest: _ignored, ...content } = receipt;
  return sha256Hex(canonicalStringify(content));
}

export function computeCommonsSeededPreflightResultDigest(
  result: CommonsSeededPreflightResult,
): string {
  return sha256Hex(canonicalStringify(result));
}
