import type {
  CommonsSeededAsBuiltReceipt,
  CommonsSeededBuildReceiptResult,
} from "../../types/garpaCommonsSeededBuildReceipt";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

export function computeCommonsSeededAsBuiltReceiptDigest(
  receipt: CommonsSeededAsBuiltReceipt,
): string {
  const { receiptDigest: _ignored, ...content } = receipt;
  return sha256Hex(canonicalStringify(content));
}

export function computeCommonsSeededBuildReceiptResultDigest(
  result: CommonsSeededBuildReceiptResult,
): string {
  return sha256Hex(canonicalStringify(result));
}
