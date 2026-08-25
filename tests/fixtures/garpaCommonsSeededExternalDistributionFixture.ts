import type {
  CommonsSeededExternalDistributionRequest,
} from "../../app/src/types/garpaCommonsSeededExternalDistribution";
import {
  computeCommonsSeededExternalDistributionEnvelopeDigest,
  computeCommonsSeededExternalDistributionEvidenceArtifactSetDigest,
  computeCommonsSeededExternalDistributionObservationDigest,
  computeCommonsSeededExternalDistributionObservedFileSetDigest,
} from "../../app/src/lib/garpa/commonsSeededExternalDistributionDigest";
import { computeCommonsSeededPublicRegistryResultDigest } from "../../app/src/lib/garpa/commonsSeededPublicRegistryDigest";
import { deriveCommonsSeededQualificationDistributionObservation } from "../../app/src/lib/garpa/deriveCommonsSeededExternalDistribution";
import { runCommonsSeededPublicRegistryGate } from "../../app/src/lib/garpa/runCommonsSeededPublicRegistryGate";
import { sha256Hex } from "../../app/src/lib/garpa/sha256";
import { buildCommonsSeededPublicRegistryRequest } from "./garpaCommonsSeededPublicRegistryFixture";

function addMilliseconds(value: string, milliseconds: number): string {
  return new Date(
    Date.parse(value) + milliseconds,
  ).toISOString();
}

export function refreshCommonsSeededExternalDistributionEnvelope(
  request: CommonsSeededExternalDistributionRequest,
): void {
  const observation = request.distributionObservation;
  observation.observationDigest =
    computeCommonsSeededExternalDistributionObservationDigest(
      observation,
    );
  request.distributionEnvelope.caseId = observation.caseId;
  request.distributionEnvelope.releaseId = observation.releaseId;
  request.distributionEnvelope.releaseNumber = 1;
  request.distributionEnvelope.releaseManifestDigest =
    observation.releaseManifestDigest;
  request.distributionEnvelope.releaseBundleDigest =
    observation.releaseBundleDigest;
  request.distributionEnvelope.registryEntryDigest =
    observation.registryEntryDigest;
  request.distributionEnvelope.distributionObservationDigest =
    observation.observationDigest;
  request.distributionEnvelope.observedFileSetDigest =
    computeCommonsSeededExternalDistributionObservedFileSetDigest(
      observation.observedFiles,
    );
  request.distributionEnvelope.evidenceArtifactSetDigest =
    computeCommonsSeededExternalDistributionEvidenceArtifactSetDigest(
      observation.evidenceArtifacts,
    );
  request.distributionEnvelope.mode = observation.mode;
  request.distributionEnvelope.eventKind = observation.eventKind;
  const observed =
    observation.mode === "observed_external_event";
  request.distributionEnvelope.publicReleaseOccurred =
    observed &&
    [
      "release_distribution",
      "release_and_registry_publication",
    ].includes(observation.eventKind);
  request.distributionEnvelope.publicRegistryPublished =
    observed &&
    [
      "registry_publication",
      "release_and_registry_publication",
    ].includes(observation.eventKind);
  request.distributionEnvelope.envelopeDigest =
    computeCommonsSeededExternalDistributionEnvelopeDigest(
      request.distributionEnvelope,
    );
}

export function refreshCommonsSeededExternalDistributionFromRegistry(
  request: CommonsSeededExternalDistributionRequest,
): void {
  const registryResult = runCommonsSeededPublicRegistryGate(
    request.seededPublicRegistryRequest,
  );
  const registryResultDigest =
    computeCommonsSeededPublicRegistryResultDigest(registryResult);
  request.expectedSeededPublicRegistryResultDigest =
    registryResultDigest;
  request.distributionEnvelope.seededPublicRegistryResultDigest =
    registryResultDigest;
  const observation = request.distributionObservation;
  if (observation.mode === "qualification_fixture") {
    request.distributionObservation =
      deriveCommonsSeededQualificationDistributionObservation(
        registryResult,
        observation.publishedAt,
        observation.observedAt,
      );
  } else {
    observation.caseId =
      registryResult.nextEntry?.caseId ?? observation.caseId;
    observation.releaseId =
      registryResult.nextEntry?.currentReleaseId ??
      observation.releaseId;
    observation.releaseManifestDigest =
      registryResult.nextEntry?.currentReleaseDigest ??
      observation.releaseManifestDigest;
    observation.releaseBundleDigest =
      registryResult.seededReleaseResult?.bundleDigest ??
      observation.releaseBundleDigest;
    observation.registryEntryDigest =
      registryResult.nextEntryDigest;
    observation.observedFiles =
      registryResult.seededReleaseResult?.releaseManifest?.files ??
      observation.observedFiles;
  }
  refreshCommonsSeededExternalDistributionEnvelope(request);
}

export function buildCommonsSeededExternalDistributionRequest(): CommonsSeededExternalDistributionRequest {
  const seededPublicRegistryRequest =
    buildCommonsSeededPublicRegistryRequest();
  const registryResult = runCommonsSeededPublicRegistryGate(
    seededPublicRegistryRequest,
  );
  if (
    !registryResult.passed ||
    !registryResult.registryUpdateApplied ||
    !registryResult.nextEntry ||
    !registryResult.seededReleaseResult?.releaseManifest
  ) {
    throw new Error(JSON.stringify(registryResult));
  }
  const publishedAt = addMilliseconds(
    seededPublicRegistryRequest.admittedAt,
    60_000,
  );
  const observedAt = addMilliseconds(publishedAt, 60_000);
  const observation =
    deriveCommonsSeededQualificationDistributionObservation(
      registryResult,
      publishedAt,
      observedAt,
    );
  const evaluatedAt = addMilliseconds(observedAt, 60_000);
  const registryResultDigest =
    computeCommonsSeededPublicRegistryResultDigest(registryResult);
  const request: CommonsSeededExternalDistributionRequest = {
    schemaVersion: 1,
    seededPublicRegistryRequest,
    expectedSeededPublicRegistryResultDigest:
      registryResultDigest,
    distributionObservation: observation,
    distributionEnvelope: {
      schemaVersion: 1,
      distributionReceiptId:
        `external-distribution:${observation.releaseId}:fixture:v1`,
      caseId: observation.caseId,
      releaseId: observation.releaseId,
      releaseNumber: 1,
      releaseManifestDigest:
        observation.releaseManifestDigest,
      releaseBundleDigest: observation.releaseBundleDigest,
      registryEntryDigest: observation.registryEntryDigest,
      seededPublicRegistryResultDigest:
        registryResultDigest,
      distributionObservationDigest:
        observation.observationDigest,
      observedFileSetDigest:
        computeCommonsSeededExternalDistributionObservedFileSetDigest(
          observation.observedFiles,
        ),
      evidenceArtifactSetDigest:
        computeCommonsSeededExternalDistributionEvidenceArtifactSetDigest(
          observation.evidenceArtifacts,
        ),
      mode: observation.mode,
      eventKind: observation.eventKind,
      evaluatedAt,
      publicRegistryPublished: false,
      publicReleaseOccurred: false,
      deploymentAuthorityClaimed: false,
      unrestrictedEquivalenceClaimed: false,
      envelopeDigest: "0".repeat(64),
    },
    admittedAt: addMilliseconds(evaluatedAt, 60_000),
  };
  refreshCommonsSeededExternalDistributionEnvelope(request);
  return request;
}

export function buildObservedExternalDistributionTestRequest(): CommonsSeededExternalDistributionRequest {
  const request =
    buildCommonsSeededExternalDistributionRequest();
  const observation = request.distributionObservation;
  observation.mode = "observed_external_event";
  observation.eventKind =
    "release_and_registry_publication";
  observation.channel = "public_registry_export";
  observation.destinationUri =
    `https://distribution.example.test/releases/${observation.releaseId}`;
  observation.externallyAccessible = true;
  observation.syntheticFixture = false;
  observation.evidenceArtifacts = [
    {
      artifactId:
        `platform-receipt:${observation.releaseId}`,
      sha256: sha256Hex(
        `platform-receipt:${observation.releaseId}`,
      ),
      mediaType: "application/json",
      uri: `${observation.destinationUri}/platform-receipt.json`,
      role: "platform_receipt",
      evidenceControl: "externally_attributed",
      capturedAt: observation.observedAt,
    },
    {
      artifactId:
        `retrieval-capture:${observation.releaseId}`,
      sha256: sha256Hex(
        `retrieval-capture:${observation.releaseId}`,
      ),
      mediaType: "application/json",
      uri: `${observation.destinationUri}/retrieval-capture.json`,
      role: "retrieval_capture",
      evidenceControl: "local_measured",
      capturedAt: observation.observedAt,
    },
    {
      artifactId:
        `registry-snapshot:${observation.releaseId}`,
      sha256: sha256Hex(
        `registry-snapshot:${observation.releaseId}`,
      ),
      mediaType: "application/json",
      uri: `${observation.destinationUri}/registry-snapshot.json`,
      role: "registry_snapshot",
      evidenceControl: "externally_attributed",
      capturedAt: observation.observedAt,
    },
  ];
  request.distributionEnvelope.distributionReceiptId =
    `external-distribution:${observation.releaseId}:observed-test:v1`;
  refreshCommonsSeededExternalDistributionEnvelope(request);
  return request;
}

export const buildSeededExternalDistributionRequest =
  buildCommonsSeededExternalDistributionRequest;
