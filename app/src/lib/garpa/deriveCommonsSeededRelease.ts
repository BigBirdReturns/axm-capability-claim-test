import type {
  GarpaReleaseManifest,
  ReleaseFileRole,
} from "../../types/garpaRelease";
import type {
  CommonsSeededReleaseFilePayload,
} from "../../types/garpaCommonsSeededRelease";
import type {
  CommonsSeededPublicationRequest,
  CommonsSeededPublicationResult,
} from "../../types/garpaCommonsSeededPublication";
import {
  computeCommonsSeededReleaseManifestDigest,
  computeReleaseFileContentDigest,
  computeUtf8ByteLength,
  releaseFileRecord,
} from "./commonsSeededReleaseDigest";
import { computeCommonsSeededPublicationResultDigest } from "./commonsSeededPublicationDigest";
import { renderCommonsSeededPublicationMarkdown } from "./renderCommonsSeededPublication";
import { renderPublicDossier } from "./renderPublicDossier";

export interface CommonsSeededReleaseIdentity {
  releaseId: string;
  releaseNumber: 1;
  state: "current";
  createdAt: string;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function file(
  path: string,
  mediaType: string,
  role: ReleaseFileRole,
  content: string,
): CommonsSeededReleaseFilePayload {
  return {
    path,
    mediaType,
    role,
    required: true,
    contentEncoding: "utf-8",
    content,
    sha256: computeReleaseFileContentDigest(content),
    byteLength: computeUtf8ByteLength(content),
  };
}

export function deriveCommonsSeededReleaseFiles(
  request: CommonsSeededPublicationRequest,
  result: CommonsSeededPublicationResult,
  identity: CommonsSeededReleaseIdentity,
): CommonsSeededReleaseFilePayload[] {
  if (!result.ordinaryPublicationGate || !result.publicationPackage) {
    throw new Error("Publication result lacks the ordinary gate or package.");
  }
  const publication = result.publicationPackage;
  const parity = result.seededVendorParityResult;
  const mission = parity?.seededMissionEvaluationResult;
  const publicationResultDigest =
    computeCommonsSeededPublicationResultDigest(result);
  const releaseMetadata = {
    schemaVersion: 1,
    releaseId: identity.releaseId,
    caseId: publication.caseId,
    releaseNumber: identity.releaseNumber,
    state: identity.state,
    createdAt: identity.createdAt,
    caseIndexDigest: publication.caseIndexDigest,
    seededPublicationResultDigest: publicationResultDigest,
    publicationPackageDigest: result.publicationPackageDigest,
    publicationGateResultDigest:
      result.ordinaryPublicationGateResultDigest,
    publicationState: result.publicationState,
  };
  const supportGraph = {
    schemaVersion: 1,
    caseId: publication.caseId,
    claims: publication.claims.map((claim) => ({
      claimId: claim.id,
      claimClass: claim.claimClass,
      scope: claim.scope,
      supportRefs: claim.supportRefs,
      limitations: claim.limitations,
      prohibitedGeneralizations: claim.prohibitedGeneralizations,
    })),
  };
  const failureRegister = {
    schemaVersion: 1,
    caseId: publication.caseId,
    failedMissionMetricIds:
      mission?.failedMetricIds ?? [],
    missedParityMetricIds:
      parity?.vendorParityEvaluation?.missedMetricIds ?? [],
    publicationFindings:
      result.ordinaryPublicationGate.findings,
  };
  const residualRegister = {
    schemaVersion: 1,
    caseId: publication.caseId,
    residualClaims: publication.claims
      .filter((claim) => claim.claimClass === "residual")
      .map((claim) => ({
        claimId: claim.id,
        text: claim.text,
        scope: claim.scope,
        limitations: claim.limitations,
        prohibitedGeneralizations: claim.prohibitedGeneralizations,
      })),
  };
  const readme = [
    `# GARPA release ${identity.releaseId}`,
    "",
    `Case: ${publication.caseId}`,
    `Release number: ${identity.releaseNumber}`,
    `Publication state: ${result.publicationState ?? "unresolved"}`,
    `Publication package digest: ${result.publicationPackageDigest}`,
    "",
    "This bundle contains only the claims admitted by the governed publication package. Its integrity is controlled by the external release manifest and verification receipt. Verification does not establish deployment authority or unrestricted product equivalence.",
    "",
  ].join("\n");

  return [
    file(
      "release.json",
      "application/json",
      "release_metadata",
      json(releaseMetadata),
    ),
    file("README.md", "text/markdown", "other", readme),
    file(
      "reality-brief.md",
      "text/markdown",
      "reality_brief",
      renderCommonsSeededPublicationMarkdown(request, result),
    ),
    file(
      "public-dossier.md",
      "text/markdown",
      "public_dossier",
      renderPublicDossier(publication, result.ordinaryPublicationGate),
    ),
    file(
      "claims/publication-claims.json",
      "application/json",
      "publication_claims",
      json(publication.claims),
    ),
    file(
      "claims/support-graph.json",
      "application/json",
      "support_graph",
      json(supportGraph),
    ),
    file(
      "claims/failure-register.json",
      "application/json",
      "failure_register",
      json(failureRegister),
    ),
    file(
      "claims/residual-register.json",
      "application/json",
      "residual_register",
      json(residualRegister),
    ),
    file(
      "receipts/publication-gate.json",
      "application/json",
      "gate_receipt",
      json(result.ordinaryPublicationGate),
    ),
    file(
      "receipts/commons-publication.json",
      "application/json",
      "gate_receipt",
      json(result),
    ),
    file(
      "receipts/rights-review.json",
      "application/json",
      "rights_receipt",
      json(publication.rightsReview),
    ),
    file(
      "receipts/safety-review.json",
      "application/json",
      "safety_receipt",
      json(publication.safetyReview),
    ),
    file(
      "receipts/redactions.json",
      "application/json",
      "redaction_receipt",
      json(publication.redactions),
    ),
    file(
      "receipts/vendor-parity.json",
      "application/json",
      "vendor_parity",
      json(parity),
    ),
    file(
      "receipts/mission-evaluation.json",
      "application/json",
      "mission_evaluation",
      json(mission),
    ),
    file(
      "evidence/vendor-artifacts.json",
      "application/json",
      "source_ledger",
      json(request.seededVendorParityRequest.parityEnvelope.vendorArtifacts),
    ),
  ].sort((left, right) => left.path.localeCompare(right.path));
}

export function deriveCommonsSeededReleaseManifest(
  _request: CommonsSeededPublicationRequest,
  result: CommonsSeededPublicationResult,
  identity: CommonsSeededReleaseIdentity,
  files: CommonsSeededReleaseFilePayload[],
): GarpaReleaseManifest {
  const publication = result.publicationPackage!;
  const manifest: GarpaReleaseManifest = {
    schemaVersion: 1,
    releaseId: identity.releaseId,
    caseId: publication.caseId,
    releaseNumber: identity.releaseNumber,
    publicationPackageDigest: result.publicationPackageDigest,
    publicationGateReceiptDigest:
      result.ordinaryPublicationGateResultDigest,
    files: files.map(releaseFileRecord),
    manifestDigest: "0".repeat(64),
    createdAt: identity.createdAt,
    state: identity.state,
  };
  manifest.manifestDigest =
    computeCommonsSeededReleaseManifestDigest(manifest);
  return manifest;
}
