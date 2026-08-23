import type {
  ArchitecturePattern,
  CapabilityPrimitive,
  ComponentObservation,
} from "../../types/garpaCommons";
import type { CommonsCatalog } from "../../types/garpaCommonsCatalog";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

export function computeCommonsObjectDigest(
  value: CapabilityPrimitive | ComponentObservation | ArchitecturePattern,
): string {
  return sha256Hex(canonicalStringify(value));
}

export function computeCommonsCatalogDigest(catalog: CommonsCatalog): string {
  const { catalogDigest: _catalogDigest, ...content } = catalog;
  return sha256Hex(canonicalStringify(content));
}
