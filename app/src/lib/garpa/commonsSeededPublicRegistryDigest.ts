import type {
  PublicCaseRegistryEntry,
  RegistryIdentityPatch,
  RegistryReleaseRecord,
  RegistryReleaseUpdateRequest,
  RegistryUpdateGateResult,
} from "../../types/garpaRegistry";
import type {
  CommonsSeededPublicRegistryEnvelope,
  CommonsSeededPublicRegistryResult,
} from "../../types/garpaCommonsSeededPublicRegistry";
import { canonicalReleaseFileRecords } from "./commonsSeededReleaseDigest";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

function sorted(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function canonicalPublicCaseRegistryEntry(
  entry: PublicCaseRegistryEntry,
): PublicCaseRegistryEntry {
  return {
    ...entry,
    aliases: sorted(entry.aliases),
    versions: [...entry.versions]
      .map((version) => ({
        ...version,
        sourceArtifactIds: sorted(version.sourceArtifactIds),
      }))
      .sort((left, right) => left.versionId.localeCompare(right.versionId)),
    lineage: [...entry.lineage]
      .map((link) => ({
        ...link,
        sourceArtifactIds: sorted(link.sourceArtifactIds),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    domainTags: sorted(entry.domainTags),
    capabilityTags: sorted(entry.capabilityTags),
    releases: [...entry.releases].sort(
      (left, right) => left.releaseNumber - right.releaseNumber,
    ),
  };
}

export function canonicalRegistryIdentityPatch(
  patch: RegistryIdentityPatch,
): RegistryIdentityPatch {
  return {
    ...patch,
    aliasesAdded: sorted(patch.aliasesAdded),
    versionsAdded: [...patch.versionsAdded]
      .map((version) => ({
        ...version,
        sourceArtifactIds: sorted(version.sourceArtifactIds),
      }))
      .sort((left, right) => left.versionId.localeCompare(right.versionId)),
    lineageLinksAdded: [...patch.lineageLinksAdded]
      .map((link) => ({
        ...link,
        sourceArtifactIds: sorted(link.sourceArtifactIds),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    domainTagsAdded: sorted(patch.domainTagsAdded),
    capabilityTagsAdded: sorted(patch.capabilityTagsAdded),
  };
}

export function computeCommonsSeededRegistryCurrentEntryDigest(
  entry: PublicCaseRegistryEntry,
): string {
  return sha256Hex(
    canonicalStringify(canonicalPublicCaseRegistryEntry(entry)),
  );
}

export function computeCommonsSeededRegistryIdentityPatchDigest(
  patch: RegistryIdentityPatch,
): string {
  return sha256Hex(
    canonicalStringify(canonicalRegistryIdentityPatch(patch)),
  );
}

export function computeCommonsSeededRegistryUpdateRequestDigest(
  request: RegistryReleaseUpdateRequest,
): string {
  return sha256Hex(
    canonicalStringify({
      ...request,
      currentEntry: canonicalPublicCaseRegistryEntry(request.currentEntry),
      candidateRelease: {
        ...request.candidateRelease,
        files: canonicalReleaseFileRecords(request.candidateRelease.files),
      },
      identityPatch: canonicalRegistryIdentityPatch(request.identityPatch),
    }),
  );
}

export function computeCommonsSeededRegistryGateResultDigest(
  gate: RegistryUpdateGateResult,
): string {
  return sha256Hex(canonicalStringify(gate));
}

export function computeCommonsSeededRegistryNextEntryDigest(
  entry: PublicCaseRegistryEntry,
): string {
  return computeCommonsSeededRegistryCurrentEntryDigest(entry);
}

export function computeCommonsSeededRegistryReleaseHistoryDigest(
  releases: RegistryReleaseRecord[],
): string {
  return sha256Hex(
    canonicalStringify(
      [...releases].sort(
        (left, right) => left.releaseNumber - right.releaseNumber,
      ),
    ),
  );
}

export function computeCommonsSeededPublicRegistryEnvelopeDigest(
  envelope: CommonsSeededPublicRegistryEnvelope,
): string {
  const { envelopeDigest: _ignored, ...content } = envelope;
  return sha256Hex(canonicalStringify(content));
}

export function computeCommonsSeededPublicRegistryResultDigest(
  result: CommonsSeededPublicRegistryResult,
): string {
  return sha256Hex(canonicalStringify(result));
}
