import type {
  PublicCaseRegistryEntry,
  RegistryIdentityPatch,
  RegistryReleaseUpdateRequest,
} from "../../types/garpaRegistry";
import type {
  CommonsSeededReleaseRequest,
  CommonsSeededReleaseResult,
} from "../../types/garpaCommonsSeededRelease";

export function deriveCommonsSeededInitialRegistryEntry(
  releaseRequest: CommonsSeededReleaseRequest,
  releaseResult: CommonsSeededReleaseResult,
): PublicCaseRegistryEntry {
  const publication = releaseResult.seededPublicationResult?.publicationPackage;
  if (!publication) {
    throw new Error("Verified release result lacks its publication package.");
  }
  return {
    schemaVersion: 1,
    caseId: publication.caseId,
    canonicalSubject: publication.subject,
    aliases: [],
    offering: publication.subject,
    versions: [],
    lineage: [],
    domainTags: [],
    capabilityTags: [],
    currentState: "publication_ready",
    currentDisposition: publication.disposition,
    releases: [],
    createdAt: publication.preparedAt,
    updatedAt: releaseRequest.seededPublicationRequest.admittedAt,
  };
}

export function deriveCommonsSeededRegistryIdentityPatch(
  releaseResult: CommonsSeededReleaseResult,
): RegistryIdentityPatch {
  const publication = releaseResult.seededPublicationResult?.publicationPackage;
  const manifest = releaseResult.releaseManifest;
  if (!publication || !manifest) {
    throw new Error("Verified release result lacks publication or manifest custody.");
  }
  return {
    canonicalSubject: publication.subject,
    aliasesAdded: [],
    offering: publication.subject,
    versionsAdded: [
      {
        versionId: `${publication.caseId}:${manifest.releaseId}:version`,
        label: `${publication.subject} R${manifest.releaseNumber}`,
        exactVersion: manifest.manifestDigest,
        firstSeenAt: manifest.createdAt,
        sourceArtifactIds: [manifest.manifestDigest],
        state: "current",
      },
    ],
    lineageLinksAdded: [],
    domainTagsAdded: [],
    capabilityTagsAdded: [],
  };
}

export function deriveCommonsSeededRegistryUpdateRequest(
  releaseRequest: CommonsSeededReleaseRequest,
  releaseResult: CommonsSeededReleaseResult,
  updatedAt: string,
): RegistryReleaseUpdateRequest {
  const publication = releaseResult.seededPublicationResult?.publicationPackage;
  const manifest = releaseResult.releaseManifest;
  if (!publication || !manifest) {
    throw new Error("Verified release result lacks publication or manifest custody.");
  }
  return {
    schemaVersion: 1,
    currentEntry: deriveCommonsSeededInitialRegistryEntry(
      releaseRequest,
      releaseResult,
    ),
    candidateRelease: manifest,
    releaseVerificationState: "current_valid",
    identityPatch: deriveCommonsSeededRegistryIdentityPatch(releaseResult),
    candidateCaseState: "publication_ready",
    candidateDisposition: publication.disposition,
    updatedAt,
  };
}
