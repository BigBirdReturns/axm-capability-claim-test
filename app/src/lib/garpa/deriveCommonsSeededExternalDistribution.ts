import type { ReleaseFileRecord } from "../../types/garpaRelease";
import type {
  CommonsSeededExternalDistributionObservation,
} from "../../types/garpaCommonsSeededExternalDistribution";
import type {
  CommonsSeededPublicRegistryResult,
} from "../../types/garpaCommonsSeededPublicRegistry";
import { canonicalReleaseFileRecords } from "./commonsSeededReleaseDigest";
import {
  computeCommonsSeededExternalDistributionObservationDigest,
} from "./commonsSeededExternalDistributionDigest";
import { sha256Hex } from "./sha256";

export function deriveCommonsSeededExternalDistributionFiles(
  registryResult: CommonsSeededPublicRegistryResult,
): ReleaseFileRecord[] {
  const manifest = registryResult.seededReleaseResult?.releaseManifest;
  if (!manifest) {
    throw new Error(
      "Admitted public-registry result lacks the verified release manifest.",
    );
  }
  return canonicalReleaseFileRecords(manifest.files);
}

export function deriveCommonsSeededQualificationDistributionObservation(
  registryResult: CommonsSeededPublicRegistryResult,
  publishedAt: string,
  observedAt: string,
): CommonsSeededExternalDistributionObservation {
  const manifest = registryResult.seededReleaseResult?.releaseManifest;
  const entry = registryResult.nextEntry;
  if (!manifest || !entry) {
    throw new Error(
      "Admitted public-registry result lacks release or registry-entry custody.",
    );
  }
  const releaseFiles =
    deriveCommonsSeededExternalDistributionFiles(registryResult);
  const destinationUri =
    `urn:garpa:qualification-fixture:${manifest.releaseId}`;
  const observation: CommonsSeededExternalDistributionObservation = {
    schemaVersion: 1,
    distributionId:
      `distribution-fixture:${manifest.releaseId}:v1`,
    mode: "qualification_fixture",
    eventKind: "release_and_registry_publication",
    channel: "other",
    destinationUri,
    caseId: manifest.caseId,
    releaseId: manifest.releaseId,
    releaseNumber: 1,
    releaseManifestDigest: manifest.manifestDigest,
    releaseBundleDigest:
      registryResult.seededReleaseResult?.bundleDigest ?? "",
    registryEntryDigest: registryResult.nextEntryDigest,
    publishedAt,
    observedAt,
    externallyAccessible: false,
    syntheticFixture: true,
    observedFiles: releaseFiles,
    evidenceArtifacts: [
      {
        artifactId:
          `qualification-fixture:${manifest.releaseId}:receipt`,
        sha256: sha256Hex(
          `qualification-fixture:${manifest.releaseId}:${entry.currentReleaseDigest}`,
        ),
        mediaType: "application/json",
        uri: destinationUri,
        role: "qualification_fixture",
        evidenceControl: "local_measured",
        capturedAt: observedAt,
      },
    ],
    observationDigest: "0".repeat(64),
  };
  observation.observationDigest =
    computeCommonsSeededExternalDistributionObservationDigest(
      observation,
    );
  return observation;
}
