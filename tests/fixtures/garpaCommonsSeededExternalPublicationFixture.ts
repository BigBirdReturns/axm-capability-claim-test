import type {
  ExternalPublicationArtifact,
  ExternalPublicationReceiptRequest,
} from "../../app/src/types/garpaExternalPublication";
import type {
  CommonsSeededExternalPublicationRequest,
} from "../../app/src/types/garpaCommonsSeededExternalPublication";
import {
  computeCommonsSeededExternalPublicationEnvelopeDigest,
} from "../../app/src/lib/garpa/commonsSeededExternalPublicationDigest";
import {
  computeExternalPublicationArtifactSetDigest,
  computeExternalPublicationReceiptDigest,
  computeExternalPublicationReceiptRequestDigest,
  computeExternalPublicationReceiptResultDigest,
} from "../../app/src/lib/garpa/externalPublicationDigest";
import {
  computeCommonsSeededPublicRegistryResultDigest,
  computeCommonsSeededRegistryNextEntryDigest,
} from "../../app/src/lib/garpa/commonsSeededPublicRegistryDigest";
import { runExternalPublicationReceiptGate } from "../../app/src/lib/garpa/runExternalPublicationReceiptGate";
import { runCommonsSeededPublicRegistryGate } from "../../app/src/lib/garpa/runCommonsSeededPublicRegistryGate";
import { sha256Hex } from "../../app/src/lib/garpa/sha256";
import { buildCommonsSeededPublicRegistryRequest } from "./garpaCommonsSeededPublicRegistryFixture";

function addMilliseconds(value: string, milliseconds: number): string {
  return new Date(Date.parse(value) + milliseconds).toISOString();
}

function byteLength(content: string): number {
  return new TextEncoder().encode(content).byteLength;
}

function refreshArtifact(artifact: ExternalPublicationArtifact): void {
  artifact.sha256 = sha256Hex(artifact.content);
  artifact.byteLength = byteLength(artifact.content);
}

export function refreshExternalPublicationReceiptRequest(
  request: ExternalPublicationReceiptRequest,
): void {
  request.artifacts.forEach(refreshArtifact);
  request.receipt.artifactIds = request.artifacts
    .map((artifact) => artifact.artifactId)
    .sort((left, right) => left.localeCompare(right));
  request.receipt.targetContentDigest =
    request.receipt.eventKind === "registry_entry_published"
      ? request.receipt.registryEntryDigest
      : request.receipt.releaseBundleDigest;
  request.receipt.receiptDigest =
    computeExternalPublicationReceiptDigest(request.receipt);
}

export function refreshCommonsSeededExternalPublicationEnvelope(
  request: CommonsSeededExternalPublicationRequest,
): void {
  refreshExternalPublicationReceiptRequest(
    request.externalPublicationRequest,
  );
  const ordinary = runExternalPublicationReceiptGate(
    request.externalPublicationRequest,
  );
  const receipt = request.externalPublicationRequest.receipt;
  const envelope = request.publicationEnvelope;
  envelope.externalPublicationReceiptId = receipt.receiptId;
  envelope.caseId = receipt.caseId;
  envelope.releaseId = receipt.releaseId;
  envelope.releaseNumber = 1;
  envelope.releaseManifestDigest = receipt.releaseManifestDigest;
  envelope.releaseBundleDigest = receipt.releaseBundleDigest;
  envelope.registryEntryDigest = receipt.registryEntryDigest;
  envelope.externalPublicationRequestDigest =
    computeExternalPublicationReceiptRequestDigest(
      request.externalPublicationRequest,
    );
  envelope.externalPublicationReceiptDigest =
    computeExternalPublicationReceiptDigest(receipt);
  envelope.externalArtifactSetDigest =
    computeExternalPublicationArtifactSetDigest(
      request.externalPublicationRequest.artifacts,
    );
  envelope.ordinaryReceiptResultDigest =
    computeExternalPublicationReceiptResultDigest(ordinary);
  envelope.evidenceClass = ordinary.evidenceClass;
  envelope.eventKind = ordinary.eventKind;
  envelope.observedAt = receipt.observedAt;
  envelope.syntheticQualificationOnly =
    ordinary.syntheticQualificationOnly;
  envelope.externalEventObserved = ordinary.eventObserved;
  envelope.publicRegistryPublished = ordinary.publicRegistryPublished;
  envelope.publicReleaseOccurred = ordinary.publicReleaseOccurred;
  envelope.envelopeDigest =
    computeCommonsSeededExternalPublicationEnvelopeDigest(envelope);
}

export function refreshCommonsSeededExternalPublicationFromRegistry(
  request: CommonsSeededExternalPublicationRequest,
): void {
  const registry = runCommonsSeededPublicRegistryGate(
    request.seededPublicRegistryRequest,
  );
  if (!registry.nextEntry || !registry.seededReleaseResult?.releaseManifest) {
    throw new Error(JSON.stringify(registry));
  }
  const registryDigest =
    computeCommonsSeededPublicRegistryResultDigest(registry);
  const entryDigest = computeCommonsSeededRegistryNextEntryDigest(
    registry.nextEntry,
  );
  const manifest = registry.seededReleaseResult.releaseManifest;
  const receipt = request.externalPublicationRequest.receipt;
  request.expectedSeededPublicRegistryResultDigest = registryDigest;
  request.publicationEnvelope.seededPublicRegistryResultDigest =
    registryDigest;
  receipt.caseId = manifest.caseId;
  receipt.releaseId = manifest.releaseId;
  receipt.releaseManifestDigest = manifest.manifestDigest;
  receipt.releaseBundleDigest = registry.seededReleaseResult.bundleDigest;
  receipt.registryEntryDigest = entryDigest;
  receipt.targetContentDigest =
    receipt.eventKind === "registry_entry_published"
      ? entryDigest
      : receipt.releaseBundleDigest;
  refreshCommonsSeededExternalPublicationEnvelope(request);
}

export function buildCommonsSeededExternalPublicationRequest(): CommonsSeededExternalPublicationRequest {
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

  const manifest = registryResult.seededReleaseResult.releaseManifest;
  const registryEntryDigest =
    computeCommonsSeededRegistryNextEntryDigest(registryResult.nextEntry);
  const registryResultDigest =
    computeCommonsSeededPublicRegistryResultDigest(registryResult);
  const publishedAt = addMilliseconds(
    seededPublicRegistryRequest.admittedAt,
    60_000,
  );
  const capturedAt = addMilliseconds(publishedAt, 60_000);
  const observedAt = addMilliseconds(capturedAt, 60_000);
  const sourceLocator =
    "fixture://garpa/commons-seeded-external-publication/registry-entry";
  const content = `${JSON.stringify(
    {
      qualificationFixture: true,
      caseId: manifest.caseId,
      releaseId: manifest.releaseId,
      releaseManifestDigest: manifest.manifestDigest,
      releaseBundleDigest: registryResult.seededReleaseResult.bundleDigest,
      registryEntryDigest,
      eventKind: "registry_entry_published",
    },
    null,
    2,
  )}\n`;
  const artifacts: ExternalPublicationArtifact[] = [
    {
      artifactId:
        "external-publication-capture:GARPA-COMMONS-TARGET-0001:R1:fixture",
      sha256: sha256Hex(content),
      byteLength: byteLength(content),
      mediaType: "application/json",
      capturePath: "qualification/registry-entry.json",
      sourceLocator,
      contentEncoding: "utf-8",
      content,
      capturedAt,
    },
  ];
  const externalPublicationRequest: ExternalPublicationReceiptRequest = {
    schemaVersion: 1,
    receipt: {
      schemaVersion: 1,
      receiptId:
        "external-publication:GARPA-COMMONS-TARGET-0001:R1:qualification:v1",
      caseId: manifest.caseId,
      releaseId: manifest.releaseId,
      releaseManifestDigest: manifest.manifestDigest,
      releaseBundleDigest: registryResult.seededReleaseResult.bundleDigest,
      registryEntryDigest,
      eventKind: "registry_entry_published",
      evidenceClass: "synthetic_qualification",
      channel: "other",
      publisher: "GARPA synthetic qualification fixture",
      sourceLocator,
      targetContentDigest: registryEntryDigest,
      publishedAt,
      observedAt,
      artifactIds: artifacts.map((artifact) => artifact.artifactId),
      syntheticQualificationOnly: true,
      publicRegistryPublished: false,
      publicReleaseOccurred: false,
      receiptDigest: "0".repeat(64),
    },
    artifacts,
    admittedAt: addMilliseconds(observedAt, 60_000),
  };
  refreshExternalPublicationReceiptRequest(externalPublicationRequest);
  const ordinary = runExternalPublicationReceiptGate(
    externalPublicationRequest,
  );
  if (!ordinary.passed) throw new Error(JSON.stringify(ordinary));

  const request: CommonsSeededExternalPublicationRequest = {
    schemaVersion: 1,
    seededPublicRegistryRequest,
    expectedSeededPublicRegistryResultDigest: registryResultDigest,
    externalPublicationRequest,
    publicationEnvelope: {
      schemaVersion: 1,
      externalPublicationReceiptId:
        externalPublicationRequest.receipt.receiptId,
      caseId: manifest.caseId,
      releaseId: manifest.releaseId,
      releaseNumber: 1,
      releaseManifestDigest: manifest.manifestDigest,
      releaseBundleDigest: registryResult.seededReleaseResult.bundleDigest,
      seededPublicRegistryResultDigest: registryResultDigest,
      registryEntryDigest,
      externalPublicationRequestDigest:
        computeExternalPublicationReceiptRequestDigest(
          externalPublicationRequest,
        ),
      externalPublicationReceiptDigest:
        computeExternalPublicationReceiptDigest(
          externalPublicationRequest.receipt,
        ),
      externalArtifactSetDigest:
        computeExternalPublicationArtifactSetDigest(artifacts),
      ordinaryReceiptResultDigest:
        computeExternalPublicationReceiptResultDigest(ordinary),
      evidenceClass: ordinary.evidenceClass,
      eventKind: ordinary.eventKind,
      observedAt,
      syntheticQualificationOnly: true,
      externalEventObserved: false,
      publicRegistryPublished: false,
      publicReleaseOccurred: false,
      deploymentAuthorityClaimed: false,
      unrestrictedEquivalenceClaimed: false,
      envelopeDigest: "0".repeat(64),
    },
    admittedAt: addMilliseconds(
      externalPublicationRequest.admittedAt,
      60_000,
    ),
  };
  refreshCommonsSeededExternalPublicationEnvelope(request);
  return request;
}

export const buildSeededExternalPublicationRequest =
  buildCommonsSeededExternalPublicationRequest;
