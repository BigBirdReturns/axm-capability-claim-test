import type { CommonsSeededPublicRegistryRequest } from "../../app/src/types/garpaCommonsSeededPublicRegistry";
import {
  computeCommonsSeededPublicRegistryEnvelopeDigest,
  computeCommonsSeededRegistryCurrentEntryDigest,
  computeCommonsSeededRegistryGateResultDigest,
  computeCommonsSeededRegistryIdentityPatchDigest,
  computeCommonsSeededRegistryNextEntryDigest,
  computeCommonsSeededRegistryReleaseHistoryDigest,
  computeCommonsSeededRegistryUpdateRequestDigest,
} from "../../app/src/lib/garpa/commonsSeededPublicRegistryDigest";
import { computeCommonsSeededReleaseResultDigest } from "../../app/src/lib/garpa/commonsSeededReleaseDigest";
import { deriveCommonsSeededRegistryUpdateRequest } from "../../app/src/lib/garpa/deriveCommonsSeededPublicRegistry";
import { runCommonsSeededReleaseGate } from "../../app/src/lib/garpa/runCommonsSeededReleaseGate";
import { applyRegistryReleaseUpdate } from "../../app/src/lib/garpa/runRegistryUpdateGate";
import { buildCommonsSeededReleaseRequest } from "./garpaCommonsSeededReleaseFixture";

function addMilliseconds(value: string, milliseconds: number): string {
  return new Date(Date.parse(value) + milliseconds).toISOString();
}

export function refreshCommonsSeededPublicRegistryEnvelope(
  request: CommonsSeededPublicRegistryRequest,
): void {
  const ordinary = applyRegistryReleaseUpdate(
    request.registryUpdateRequest,
  );
  request.registryEnvelope.releaseId =
    request.registryUpdateRequest.candidateRelease.releaseId;
  request.registryEnvelope.releaseNumber = 1;
  request.registryEnvelope.releaseManifestDigest =
    request.registryUpdateRequest.candidateRelease.manifestDigest;
  request.registryEnvelope.currentEntryDigest =
    computeCommonsSeededRegistryCurrentEntryDigest(
      request.registryUpdateRequest.currentEntry,
    );
  request.registryEnvelope.registryUpdateRequestDigest =
    computeCommonsSeededRegistryUpdateRequestDigest(
      request.registryUpdateRequest,
    );
  request.registryEnvelope.identityPatchDigest =
    computeCommonsSeededRegistryIdentityPatchDigest(
      request.registryUpdateRequest.identityPatch,
    );
  request.registryEnvelope.registryUpdateGateResultDigest =
    computeCommonsSeededRegistryGateResultDigest(ordinary.gate);
  request.registryEnvelope.nextEntryDigest = ordinary.entry
    ? computeCommonsSeededRegistryNextEntryDigest(ordinary.entry)
    : "0".repeat(64);
  request.registryEnvelope.releaseHistoryDigest = ordinary.entry
    ? computeCommonsSeededRegistryReleaseHistoryDigest(
        ordinary.entry.releases,
      )
    : "0".repeat(64);
  request.registryEnvelope.updatedAt =
    request.registryUpdateRequest.updatedAt;
  request.registryEnvelope.envelopeDigest =
    computeCommonsSeededPublicRegistryEnvelopeDigest(
      request.registryEnvelope,
    );
}

export function refreshCommonsSeededPublicRegistryFromRelease(
  request: CommonsSeededPublicRegistryRequest,
): void {
  const releaseResult = runCommonsSeededReleaseGate(
    request.seededReleaseRequest,
  );
  const releaseResultDigest =
    computeCommonsSeededReleaseResultDigest(releaseResult);
  request.expectedSeededReleaseResultDigest = releaseResultDigest;
  request.registryEnvelope.seededReleaseResultDigest =
    releaseResultDigest;
  request.registryEnvelope.releaseBundleDigest =
    releaseResult.bundleDigest;
  request.registryUpdateRequest =
    deriveCommonsSeededRegistryUpdateRequest(
      request.seededReleaseRequest,
      releaseResult,
      request.registryUpdateRequest.updatedAt,
    );
  refreshCommonsSeededPublicRegistryEnvelope(request);
}

export function buildCommonsSeededPublicRegistryRequest(): CommonsSeededPublicRegistryRequest {
  const seededReleaseRequest = buildCommonsSeededReleaseRequest();
  const releaseResult = runCommonsSeededReleaseGate(
    seededReleaseRequest,
  );
  if (
    !releaseResult.passed ||
    !releaseResult.releaseVerified ||
    releaseResult.releaseState !== "current_valid" ||
    !releaseResult.releaseManifest
  ) {
    throw new Error(JSON.stringify(releaseResult));
  }
  const updatedAt = addMilliseconds(
    seededReleaseRequest.admittedAt,
    60_000,
  );
  const registryUpdateRequest =
    deriveCommonsSeededRegistryUpdateRequest(
      seededReleaseRequest,
      releaseResult,
      updatedAt,
    );
  const ordinary = applyRegistryReleaseUpdate(
    registryUpdateRequest,
  );
  if (!ordinary.gate.passed || !ordinary.entry) {
    throw new Error(JSON.stringify(ordinary));
  }
  const releaseResultDigest =
    computeCommonsSeededReleaseResultDigest(releaseResult);
  const request: CommonsSeededPublicRegistryRequest = {
    schemaVersion: 1,
    seededReleaseRequest,
    expectedSeededReleaseResultDigest: releaseResultDigest,
    registryUpdateRequest,
    registryEnvelope: {
      schemaVersion: 1,
      registryReceiptId:
        "public-registry:GARPA-COMMONS-TARGET-0001:R1:v1",
      caseId: releaseResult.releaseManifest.caseId,
      releaseId: releaseResult.releaseManifest.releaseId,
      releaseNumber: 1,
      releaseManifestDigest:
        releaseResult.releaseManifest.manifestDigest,
      releaseBundleDigest: releaseResult.bundleDigest,
      seededReleaseResultDigest: releaseResultDigest,
      currentEntryDigest:
        computeCommonsSeededRegistryCurrentEntryDigest(
          registryUpdateRequest.currentEntry,
        ),
      registryUpdateRequestDigest:
        computeCommonsSeededRegistryUpdateRequestDigest(
          registryUpdateRequest,
        ),
      identityPatchDigest:
        computeCommonsSeededRegistryIdentityPatchDigest(
          registryUpdateRequest.identityPatch,
        ),
      registryUpdateGateResultDigest:
        computeCommonsSeededRegistryGateResultDigest(ordinary.gate),
      nextEntryDigest:
        computeCommonsSeededRegistryNextEntryDigest(ordinary.entry),
      releaseHistoryDigest:
        computeCommonsSeededRegistryReleaseHistoryDigest(
          ordinary.entry.releases,
        ),
      updatedAt,
      publicRegistryPublished: false,
      publicReleaseOccurred: false,
      deploymentAuthorityClaimed: false,
      unrestrictedEquivalenceClaimed: false,
      envelopeDigest: "0".repeat(64),
    },
    admittedAt: addMilliseconds(updatedAt, 60_000),
  };
  refreshCommonsSeededPublicRegistryEnvelope(request);
  return request;
}

export const buildSeededPublicRegistryRequest =
  buildCommonsSeededPublicRegistryRequest;
