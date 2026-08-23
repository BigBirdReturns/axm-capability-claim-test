import type { CaseDisposition } from "./garpaPublication";
import type { GarpaReleaseManifest } from "./garpaRelease";

export type RegistryCaseState =
  | "created"
  | "evidence_blocked"
  | "goal_admitted"
  | "architecture_candidate"
  | "qualification_frozen"
  | "build_assembled"
  | "evaluation_complete"
  | "publication_ready"
  | "superseded"
  | "withdrawn";

export interface OfferingVersionIdentity {
  versionId: string;
  label: string;
  exactVersion?: string;
  firstSeenAt: string;
  lastSeenAt?: string;
  sourceArtifactIds: string[];
  state: "current" | "superseded" | "unknown";
}

export type IdentityLineageRelation =
  | "same_offering"
  | "rebrand"
  | "successor"
  | "predecessor"
  | "acquired_brand"
  | "organizational_transfer";

export interface IdentityLineageLink {
  id: string;
  fromSubject: string;
  toSubject: string;
  relation: IdentityLineageRelation;
  effectiveAt?: string;
  sourceArtifactIds: string[];
  note: string;
}

export interface RegistryReleaseRecord {
  releaseId: string;
  releaseNumber: number;
  manifestDigest: string;
  state: "current" | "superseded" | "withdrawn";
  priorReleaseDigest?: string;
  supersedesReleaseId?: string;
  createdAt: string;
}

export interface PublicCaseRegistryEntry {
  schemaVersion: 1;
  caseId: string;
  canonicalSubject: string;
  aliases: string[];
  claimant?: string;
  organization?: string;
  offering?: string;
  versions: OfferingVersionIdentity[];
  lineage: IdentityLineageLink[];
  domainTags: string[];
  capabilityTags: string[];
  currentState: RegistryCaseState;
  currentDisposition?: CaseDisposition;
  releases: RegistryReleaseRecord[];
  currentReleaseId?: string;
  currentReleaseDigest?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegistryIdentityPatch {
  canonicalSubject: string;
  aliasesAdded: string[];
  claimant?: string;
  organization?: string;
  offering?: string;
  versionsAdded: OfferingVersionIdentity[];
  lineageLinksAdded: IdentityLineageLink[];
  domainTagsAdded: string[];
  capabilityTagsAdded: string[];
}

export interface RegistryReleaseUpdateRequest {
  schemaVersion: 1;
  currentEntry: PublicCaseRegistryEntry;
  candidateRelease: GarpaReleaseManifest;
  releaseVerificationState:
    | "current_valid"
    | "superseded_valid"
    | "withdrawn_valid";
  expectedCurrentReleaseId?: string;
  expectedCurrentReleaseDigest?: string;
  identityPatch: RegistryIdentityPatch;
  candidateCaseState: RegistryCaseState;
  candidateDisposition?: CaseDisposition;
  updatedAt: string;
}

export type RegistryUpdateState =
  | "case_mismatch"
  | "current_release_conflict"
  | "release_number_gap"
  | "release_lineage_mismatch"
  | "release_identity_reused"
  | "identity_lineage_missing"
  | "release_not_current_valid"
  | "invalid_case_transition"
  | "registry_update_admitted";

export interface RegistryUpdateFinding {
  state: Exclude<RegistryUpdateState, "registry_update_admitted">;
  reason: string;
  requiredAction: string;
}

export interface RegistryUpdateGateResult {
  passed: boolean;
  state: RegistryUpdateState;
  findings: RegistryUpdateFinding[];
  nextReleaseNumber: number;
}

export interface RegistryUpdateResult {
  gate: RegistryUpdateGateResult;
  entry?: PublicCaseRegistryEntry;
}
