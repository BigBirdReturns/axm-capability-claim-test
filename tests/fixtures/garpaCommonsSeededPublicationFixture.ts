import type { CommonsSeededPublicationRequest } from "../../app/src/types/garpaCommonsSeededPublication";
import type { PublicationPackage } from "../../app/src/types/garpaPublication";
import {
  computeCommonsSeededPublicationArtifactSetDigest,
  computeCommonsSeededPublicationCaseIndexDigest,
  computeCommonsSeededPublicationClaimSetDigest,
  computeCommonsSeededPublicationEnvelopeDigest,
  computeCommonsSeededPublicationPackageDigest,
  computeCommonsSeededPublicationUpstreamDigestSetDigest,
} from "../../app/src/lib/garpa/commonsSeededPublicationDigest";
import { computeCommonsSeededVendorParityResultDigest } from "../../app/src/lib/garpa/commonsSeededVendorParityDigest";
import {
  deriveCommonsSeededPublicationArtifacts,
  deriveCommonsSeededPublicationClaims,
  deriveCommonsSeededPublicationDisposition,
  deriveCommonsSeededPublicationUpstreamDigests,
} from "../../app/src/lib/garpa/deriveCommonsSeededPublication";
import { runCommonsSeededVendorParityGate } from "../../app/src/lib/garpa/runCommonsSeededVendorParityGate";
import { buildCommonsSeededVendorParityRequest } from "./garpaCommonsSeededVendorParityFixture";

function addMilliseconds(value: string, milliseconds: number): string {
  return new Date(Date.parse(value) + milliseconds).toISOString();
}

export function refreshCommonsSeededPublicationEnvelope(
  request: CommonsSeededPublicationRequest,
): void {
  request.publicationPackage.caseIndexDigest =
    computeCommonsSeededPublicationCaseIndexDigest(
      request.publicationPackage.caseId,
      request.publicationPackage.upstreamDigests,
    );
  request.publicationEnvelope.caseIndexDigest =
    request.publicationPackage.caseIndexDigest;
  request.publicationEnvelope.publicationPackageDigest =
    computeCommonsSeededPublicationPackageDigest(
      request.publicationPackage,
    );
  request.publicationEnvelope.claimSetDigest =
    computeCommonsSeededPublicationClaimSetDigest(
      request.publicationPackage.claims,
    );
  request.publicationEnvelope.upstreamDigestSetDigest =
    computeCommonsSeededPublicationUpstreamDigestSetDigest(
      request.publicationPackage.upstreamDigests,
    );
  request.publicationEnvelope.artifactSetDigest =
    computeCommonsSeededPublicationArtifactSetDigest(
      request.publicationEnvelope.publicationArtifacts,
    );
  request.publicationEnvelope.envelopeDigest =
    computeCommonsSeededPublicationEnvelopeDigest(
      request.publicationEnvelope,
    );
}

export function buildCommonsSeededPublicationRequest(): CommonsSeededPublicationRequest {
  const seededVendorParityRequest =
    buildCommonsSeededVendorParityRequest();
  const parityResult = runCommonsSeededVendorParityGate(
    seededVendorParityRequest,
  );
  if (
    !parityResult.passed ||
    !parityResult.parityState ||
    !parityResult.seededMissionEvaluationResult
  ) {
    throw new Error(JSON.stringify(parityResult));
  }
  const firstRun = seededVendorParityRequest.seededMissionEvaluationRequest
    .testRunRequests[0]!;
  const qualification = firstRun.seededPreflightRequest
    .seededBuildReceiptRequest.seededBuildManifestRequest
    .seededQualificationRequest.qualificationContract;
  const asBuilt = firstRun.seededPreflightRequest
    .seededBuildReceiptRequest.asBuiltReceipt;
  const subject = "GARPA Commons-seeded target observation system";
  const upstreamDigests = deriveCommonsSeededPublicationUpstreamDigests(
    seededVendorParityRequest,
    parityResult,
  );
  const claims = deriveCommonsSeededPublicationClaims(
    seededVendorParityRequest,
    parityResult,
    subject,
  );
  const artifacts = deriveCommonsSeededPublicationArtifacts(
    seededVendorParityRequest,
  );
  const rightsReviewedAt = addMilliseconds(
    seededVendorParityRequest.admittedAt,
    30_000,
  );
  const safetyReviewedAt = addMilliseconds(
    seededVendorParityRequest.admittedAt,
    40_000,
  );
  const preparedAt = addMilliseconds(
    seededVendorParityRequest.admittedAt,
    60_000,
  );
  const publicationPackage: PublicationPackage = {
    schemaVersion: 1,
    caseId: asBuilt.caseId,
    releaseCandidateId: "GARPA-COMMONS-TARGET-0001-R1-CANDIDATE",
    subject,
    caseIndexDigest: computeCommonsSeededPublicationCaseIndexDigest(
      asBuilt.caseId,
      upstreamDigests,
    ),
    upstreamDigests,
    disposition: deriveCommonsSeededPublicationDisposition(parityResult),
    vendorParityState: parityResult.parityState,
    claims,
    audience: "public",
    rightsReview: {
      state: "clear",
      artifactDecisions: artifacts.map((artifact) => ({
        artifactId: artifact.artifactId,
        rightsClass: "citation_only" as const,
        includedInRelease: false,
        note:
          "The vendor evidence remains digest-bound and cited but is not redistributed by this publication candidate.",
      })),
      reviewedAt: rightsReviewedAt,
      reviewer: "GARPA publication rights reviewer",
    },
    safetyReview: {
      state: "clear",
      findings: [],
      reviewedAt: safetyReviewedAt,
      reviewer: "GARPA publication safety reviewer",
    },
    redactions: [],
    preparedAt,
    preparedBy: "GARPA case owner",
  };
  const evaluatedAt = addMilliseconds(preparedAt, 60_000);
  const parityResultDigest =
    computeCommonsSeededVendorParityResultDigest(parityResult);
  const request: CommonsSeededPublicationRequest = {
    schemaVersion: 1,
    seededVendorParityRequest,
    expectedSeededVendorParityResultDigest: parityResultDigest,
    publicationPackage,
    publicationEnvelope: {
      schemaVersion: 1,
      publicationId: publicationPackage.releaseCandidateId,
      caseId: asBuilt.caseId,
      caseIndexDigest: publicationPackage.caseIndexDigest,
      missionOutcomeDigest: qualification.missionOutcomeDigest,
      qualificationContractDigest: asBuilt.qualificationContractDigest,
      asBuiltReceiptDigest: asBuilt.receiptDigest,
      campaignPreflightReceiptDigest:
        parityResult.seededMissionEvaluationResult
          .campaignPreflightReceiptDigest,
      runSetDigest:
        parityResult.seededMissionEvaluationResult.runSetDigest,
      seededMissionEvaluationResultDigest:
        parityResult.seededMissionEvaluationResultDigest,
      seededVendorParityResultDigest: parityResultDigest,
      vendorParityEvaluationDigest:
        parityResult.vendorParityEvaluationDigest,
      publicationPackageDigest:
        computeCommonsSeededPublicationPackageDigest(publicationPackage),
      claimSetDigest:
        computeCommonsSeededPublicationClaimSetDigest(claims),
      upstreamDigestSetDigest:
        computeCommonsSeededPublicationUpstreamDigestSetDigest(
          upstreamDigests,
        ),
      artifactSetDigest:
        computeCommonsSeededPublicationArtifactSetDigest(artifacts),
      publicationArtifacts: artifacts,
      evaluatedAt,
      unrestrictedEquivalenceClaimed: false,
      deploymentAuthorityClaimed: false,
      releaseAuthorityClaimed: false,
      publicReleaseOccurred: false,
      envelopeDigest: "0".repeat(64),
    },
    admittedAt: addMilliseconds(evaluatedAt, 60_000),
  };
  refreshCommonsSeededPublicationEnvelope(request);
  return request;
}

export const buildSeededPublicationRequest =
  buildCommonsSeededPublicationRequest;
