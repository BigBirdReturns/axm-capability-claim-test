import type { CommonsTransferResult } from "../../types/garpaCommonsTransfer";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

export function computeCommonsTransferResultDigest(
  result: CommonsTransferResult,
): string {
  return sha256Hex(canonicalStringify(result));
}
