import type { CommonsSeededReleaseRequest } from "../../app/src/types/garpaCommonsSeededRelease";
import {
  computeCommonsSeededReleaseBundleDigest,
  computeCommonsSeededReleaseEnvelopeDigest,
  computeCommonsSeededReleaseFileSetDigest,
  computeCommonsSeededReleaseManifestDigest,
  computeReleaseFileContentDigest,
  computeUtf8ByteLength,
  releaseFileRecord,
} from "../../app/src/lib/garpa/commonsSeededReleaseDigest";
import { computeCommonsSeededPublicationResultDigest } from "../../app/src/lib/garpa/commonsSeededPublicationDigest";
import {
  deriveCommonsSeededReleaseFiles,
  deriveCommonsSeededReleaseManifest,
} from "../../app/src/lib/garpa/deriveCommonsSeededRelease";
import { runCommonsSeededPublicationGate } from "../../app/src/lib/garpa/runCommonsSeededPublicationGate";
import {
  buildCommonsSeededPublicationRequest,
  refreshCommonsSeededPublicationEnvelope,
} from "./garpaCommonsSeededPublicationFixture";

function addMilliseconds(value: string, milliseconds: number): string {
  return new Date(Date.parse(value) + milliseconds).toISOString();
}

export function refreshCommonsSeededReleaseEnvelope(
  request: CommonsSeededReleaseRequest,
): void {
  request.releaseFiles.forEach((file) => {
    file.sha256 = computeReleaseFileContentDigest(file.content);
    file.byteLength = computeUtf8ByteLength(file.content);
  });
  request.releaseManifest.files = request.releaseFiles.map(releaseFileRecord);
  request.releaseManifest.manifestDigest =
    computeCommonsSeededReleaseManifestDigest(request.releaseManifest);
  request.releaseEnvelope.releaseManifestDigest =
    request.releaseManifest.manifestDigest;
  request.releaseEnvelope.fileSetDigest =
    computeCommonsSeededReleaseFileSetDigest(request.releaseFiles);
  request.releaseEnvelope.bundleDigest =
    computeCommonsSeededReleaseBundleDigest(request.releaseFiles);
  request.releaseEnvelope.envelopeDigest =
    computeCommonsSeededReleaseEnvelopeDigest(request.releaseEnvelope);
}

export function refreshCommonsSeededReleaseFromPublication(
  request: CommonsSeededReleaseRequest,
): void {
  const publicationResult = runCommonsSeededPublicationGate(
    request.seededPublicationRequest,
  );
  const publicationResultDigest =
    computeCommonsSeededPublicationResultDigest(publicationResult);
  request.expectedSeededPublicationResultDigest = publicationResultDigest;
  request.releaseEnvelope.seededPublicationResultDigest =
    publicationResultDigest;
  request.releaseEnvelope.caseIndexDigest =
    publicationResult.publicationPackage?.caseIndexDigest ?? "0".repeat(64);
  request.releaseEnvelope.publicationPackageDigest =
    publicationResult.publicationPackageDigest;
  request.releaseEnvelope.publicationGateResultDigest =
    publicationResult.ordinaryPublicationGateResultDigest;
  const identity = {
    releaseId: request.releaseManifest.releaseId,
    releaseNumber: 1 as const,
    state: "current" as const,
    createdAt: request.releaseManifest.createdAt,
  };
  request.releaseFiles = deriveCommonsSeededReleaseFiles(
    request.seededPublicationRequest,
    publicationResult,
    identity,
  );
  request.releaseManifest = deriveCommonsSeededReleaseManifest(
    request.seededPublicationRequest,
    publicationResult,
    identity,
    request.releaseFiles,
  );
  refreshCommonsSeededReleaseEnvelope(request);
}

export function buildCommonsSeededReleaseRequest(): CommonsSeededReleaseRequest {
  const seededPublicationRequest =
    buildCommonsSeededPublicationRequest();
  const publicationResult = runCommonsSeededPublicationGate(
    seededPublicationRequest,
  );
  if (
    !publicationResult.passed ||
    !publicationResult.publicationReady ||
    !publicationResult.publicationPackage ||
    !publicationResult.ordinaryPublicationGate
  ) {
    throw new Error(JSON.stringify(publicationResult));
  }
  const createdAt = addMilliseconds(
    seededPublicationRequest.admittedAt,
    60_000,
  );
  const identity = {
    releaseId: "GARPA-COMMONS-TARGET-0001-R1",
    releaseNumber: 1 as const,
    state: "current" as const,
    createdAt,
  };
  const releaseFiles = deriveCommonsSeededReleaseFiles(
    seededPublicationRequest,
    publicationResult,
    identity,
  );
  const releaseManifest = deriveCommonsSeededReleaseManifest(
    seededPublicationRequest,
    publicationResult,
    identity,
    releaseFiles,
  );
  const verifiedAt = addMilliseconds(createdAt, 60_000);
  const publicationResultDigest =
    computeCommonsSeededPublicationResultDigest(publicationResult);
  const request: CommonsSeededReleaseRequest = {
    schemaVersion: 1,
    seededPublicationRequest,
    expectedSeededPublicationResultDigest: publicationResultDigest,
    releaseManifest,
    releaseFiles,
    releaseEnvelope: {
      schemaVersion: 1,
      releaseReceiptId:
        "release-verification:GARPA-COMMONS-TARGET-0001:R1:v1",
      caseId: releaseManifest.caseId,
      releaseId: releaseManifest.releaseId,
      releaseNumber: 1,
      releaseState: "current",
      caseIndexDigest:
        publicationResult.publicationPackage.caseIndexDigest,
      seededPublicationResultDigest: publicationResultDigest,
      publicationPackageDigest:
        publicationResult.publicationPackageDigest,
      publicationGateResultDigest:
        publicationResult.ordinaryPublicationGateResultDigest,
      releaseManifestDigest: releaseManifest.manifestDigest,
      fileSetDigest:
        computeCommonsSeededReleaseFileSetDigest(releaseFiles),
      bundleDigest:
        computeCommonsSeededReleaseBundleDigest(releaseFiles),
      verifiedAt,
      publicationReady: true,
      unrestrictedEquivalenceClaimed: false,
      deploymentAuthorityClaimed: false,
      registryUpdated: false,
      publicReleaseOccurred: false,
      envelopeDigest: "0".repeat(64),
    },
    admittedAt: addMilliseconds(verifiedAt, 60_000),
  };
  refreshCommonsSeededReleaseEnvelope(request);
  return request;
}

export const buildSeededReleaseRequest =
  buildCommonsSeededReleaseRequest;
export { refreshCommonsSeededPublicationEnvelope };
