import type { ReleaseFileRecord } from "../../types/garpaRelease";
import type {
  CommonsSeededDistributionEvidenceArtifact,
  CommonsSeededExternalDistributionEnvelope,
  CommonsSeededExternalDistributionObservation,
  CommonsSeededExternalDistributionResult,
} from "../../types/garpaCommonsSeededExternalDistribution";
import { canonicalReleaseFileRecords } from "./commonsSeededReleaseDigest";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

export function canonicalDistributionEvidenceArtifacts(
  artifacts: CommonsSeededDistributionEvidenceArtifact[],
): CommonsSeededDistributionEvidenceArtifact[] {
  return [...artifacts]
    .map((artifact) => ({ ...artifact }))
    .sort((left, right) => left.artifactId.localeCompare(right.artifactId));
}

export function computeCommonsSeededExternalDistributionObservationDigest(
  observation: CommonsSeededExternalDistributionObservation,
): string {
  const { observationDigest: _ignored, ...content } = observation;
  return sha256Hex(
    canonicalStringify({
      ...content,
      observedFiles: canonicalReleaseFileRecords(content.observedFiles),
      evidenceArtifacts: canonicalDistributionEvidenceArtifacts(
        content.evidenceArtifacts,
      ),
    }),
  );
}

export function computeCommonsSeededExternalDistributionObservedFileSetDigest(
  files: ReleaseFileRecord[],
): string {
  return sha256Hex(
    canonicalStringify(canonicalReleaseFileRecords(files)),
  );
}

export function computeCommonsSeededExternalDistributionEvidenceArtifactSetDigest(
  artifacts: CommonsSeededDistributionEvidenceArtifact[],
): string {
  return sha256Hex(
    canonicalStringify(canonicalDistributionEvidenceArtifacts(artifacts)),
  );
}

export function computeCommonsSeededExternalDistributionEnvelopeDigest(
  envelope: CommonsSeededExternalDistributionEnvelope,
): string {
  const { envelopeDigest: _ignored, ...content } = envelope;
  return sha256Hex(canonicalStringify(content));
}

export function computeCommonsSeededExternalDistributionResultDigest(
  result: CommonsSeededExternalDistributionResult,
): string {
  return sha256Hex(canonicalStringify(result));
}
