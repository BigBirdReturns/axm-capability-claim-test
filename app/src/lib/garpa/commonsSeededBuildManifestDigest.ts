import type {
  ArchitectureComponentSelection,
} from "../../types/garpaArchitecture";
import type {
  BuildManifest,
  BuildManifestComponent,
  BuildManifestSubstitutionPolicy,
} from "../../types/garpaBuild";
import type { CommonsSeededBuildManifestResult } from "../../types/garpaCommonsSeededBuildManifest";
import type { CommonsSeededQualificationResult } from "../../types/garpaCommonsSeededQualification";
import type { QualificationContract } from "../../types/garpaQualification";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

export function computeCommonsSeededQualificationResultDigest(
  result: CommonsSeededQualificationResult,
): string {
  return sha256Hex(canonicalStringify(result));
}

export function computeTargetQualificationContractDigest(
  contract: QualificationContract,
): string {
  return sha256Hex(canonicalStringify(contract));
}

export function computeArchitectureConfigurationDigest(
  selection: ArchitectureComponentSelection,
): string {
  return sha256Hex(canonicalStringify(selection.configuration));
}

export function computeBuildManifestComponentDigest(
  component: BuildManifestComponent,
): string {
  return sha256Hex(canonicalStringify(component));
}

export function computeBuildManifestSubstitutionPolicyDigest(
  policy: BuildManifestSubstitutionPolicy,
): string {
  return sha256Hex(canonicalStringify(policy));
}

export function computeTargetBuildManifestDigest(
  manifest: BuildManifest,
): string {
  const { manifestDigest: _manifestDigest, ...content } = manifest;
  return sha256Hex(canonicalStringify(content));
}

export function computeCommonsSeededBuildManifestResultDigest(
  result: CommonsSeededBuildManifestResult,
): string {
  return sha256Hex(canonicalStringify(result));
}
