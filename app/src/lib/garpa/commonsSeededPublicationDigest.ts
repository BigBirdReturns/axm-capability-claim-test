import type { PublicationClaim, PublicationPackage } from "../../types/garpaPublication";
import type {
  CommonsSeededPublicationArtifactRef,
  CommonsSeededPublicationEnvelope,
  CommonsSeededPublicationResult,
} from "../../types/garpaCommonsSeededPublication";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

function sorted(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function canonicalPublicationClaims(
  claims: PublicationClaim[],
): PublicationClaim[] {
  return [...claims]
    .map((claim) => ({
      ...claim,
      scope: {
        ...claim.scope,
        scenarioIds: claim.scope.scenarioIds
          ? sorted(claim.scope.scenarioIds)
          : undefined,
        metricIds: claim.scope.metricIds
          ? sorted(claim.scope.metricIds)
          : undefined,
      },
      supportRefs: [...claim.supportRefs].sort((left, right) =>
        canonicalStringify(left).localeCompare(canonicalStringify(right)),
      ),
      limitations: sorted(claim.limitations),
      prohibitedGeneralizations: sorted(claim.prohibitedGeneralizations),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function canonicalPublicationArtifacts(
  artifacts: CommonsSeededPublicationArtifactRef[],
): CommonsSeededPublicationArtifactRef[] {
  return [...artifacts]
    .map((artifact) => ({ ...artifact }))
    .sort((left, right) => left.artifactId.localeCompare(right.artifactId));
}

export function computeCommonsSeededPublicationPackageDigest(
  publication: PublicationPackage,
): string {
  return sha256Hex(canonicalStringify(publication));
}

export function computeCommonsSeededPublicationClaimSetDigest(
  claims: PublicationClaim[],
): string {
  return sha256Hex(canonicalStringify(canonicalPublicationClaims(claims)));
}

export function computeCommonsSeededPublicationUpstreamDigestSetDigest(
  upstreamDigests: Record<string, string>,
): string {
  return sha256Hex(canonicalStringify(upstreamDigests));
}

export function computeCommonsSeededPublicationArtifactSetDigest(
  artifacts: CommonsSeededPublicationArtifactRef[],
): string {
  return sha256Hex(canonicalStringify(canonicalPublicationArtifacts(artifacts)));
}

export function computeCommonsSeededPublicationCaseIndexDigest(
  caseId: string,
  upstreamDigests: Record<string, string>,
): string {
  return sha256Hex(canonicalStringify({ caseId, upstreamDigests }));
}

export function computeCommonsSeededPublicationEnvelopeDigest(
  envelope: CommonsSeededPublicationEnvelope,
): string {
  const { envelopeDigest: _ignored, ...content } = envelope;
  return sha256Hex(
    canonicalStringify({
      ...content,
      publicationArtifacts: canonicalPublicationArtifacts(
        content.publicationArtifacts,
      ),
    }),
  );
}

export function computeCommonsSeededPublicationResultDigest(
  result: CommonsSeededPublicationResult,
): string {
  return sha256Hex(canonicalStringify(result));
}
