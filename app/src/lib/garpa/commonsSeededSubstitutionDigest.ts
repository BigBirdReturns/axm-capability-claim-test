import type { CommonsComponentProjectionResult } from "../../types/garpaCommonsProjection";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

export function computeCommonsProjectionResultDigest(
  result: CommonsComponentProjectionResult,
): string {
  return sha256Hex(canonicalStringify(result));
}
