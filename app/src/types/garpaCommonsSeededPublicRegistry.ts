import type {
  PublicCaseRegistryEntry,
  RegistryIdentityPatch,
  RegistryReleaseUpdateRequest,
  RegistryUpdateResult,
  RegistryUpdateState,
} from "./garpaRegistry";
import type {
  CommonsSeededReleaseRequest,
  CommonsSeededReleaseResult,
} from "./garpaCommonsSeededRelease";

export interface CommonsSeededPublicRegistryEnvelope {
  schemaVersion: 1;
  registryReceiptId: string;
  caseId: string;
  releaseId: string;
  releaseNumber: 1;
  releaseManifestDigest: string;
  releaseBundleDigest: string;
  seededReleaseResultDigest: string;
  currentEntryDigest: string;
  registryUpdateRequestDigest: string;
  identityPatchDigest: string;
  registryUpdateGateResultDigest: string;
  nextEntryDigest: string;
  releaseHistoryDigest: string;
  updatedAt: string;
  publicRegistryPublished: false;
  publicReleaseOccurred: false;
  deploymentAuthorityClaimed: false;
  unrestrictedEquivalenceClaimed: false;
  envelopeDigest: string;
}

export interface CommonsSeededPublicRegistryRequest {
  schemaVersion: 1;
  seededReleaseRequest: CommonsSeededReleaseRequest;
  expectedSeededReleaseResultDigest: string;
  registryUpdateRequest: RegistryReleaseUpdateRequest;
  registryEnvelope: CommonsSeededPublicRegistryEnvelope;
  admittedAt: string;
}

export type CommonsSeededPublicRegistryFindingState =
  | "release_result_mismatch"
  | "release_record_not_admitted"
  | "release_not_verified"
  | "registry_update_request_digest_mismatch"
  | "registry_envelope_digest_mismatch"
  | "registry_case_mismatch"
  | "registry_release_mismatch"
  | "registry_time_order_invalid"
  | "registry_current_entry_mismatch"
  | "registry_identity_patch_mismatch"
  | "registry_transition_mismatch"
  | "ordinary_registry_gate_failed"
  | "ordinary_registry_entry_missing"
  | "registry_gate_result_digest_mismatch"
  | "registry_next_entry_digest_mismatch"
  | "registry_release_history_mismatch"
  | "public_registry_publication_attempted"
  | "public_release_attempted"
  | "deployment_authority_attempted"
  | "unrestricted_equivalence_attempted"
  | "public_registry_validation_failed";

export interface CommonsSeededPublicRegistryFinding {
  state: CommonsSeededPublicRegistryFindingState;
  releaseId?: string;
  reason: string;
  requiredAction: string;
}

export type CommonsSeededPublicRegistryState =
  | "seeded_public_registry_blocked"
  | "seeded_public_registry_incomplete"
  | "seeded_public_registry_admitted";

export interface CommonsSeededPublicRegistryResult {
  passed: boolean;
  state: CommonsSeededPublicRegistryState;
  registryUpdateApplied: boolean;
  registryState?: RegistryUpdateState;
  seededReleaseResult?: CommonsSeededReleaseResult;
  seededReleaseResultDigest: string;
  currentEntryDigest: string;
  registryUpdateRequestDigest: string;
  registryEnvelopeDigest: string;
  identityPatchDigest: string;
  registryUpdateGateResultDigest: string;
  nextEntryDigest: string;
  releaseHistoryDigest: string;
  ordinaryRegistryUpdate?: RegistryUpdateResult;
  currentEntry?: PublicCaseRegistryEntry;
  nextEntry?: PublicCaseRegistryEntry;
  identityPatch?: RegistryIdentityPatch;
  findings: CommonsSeededPublicRegistryFinding[];
  validationErrors: string[];
  pullList: string[];
  prohibitedTransitions: string[];
}
