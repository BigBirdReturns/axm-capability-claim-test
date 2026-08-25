import type {
  ExternalPublicationEvidenceClass,
  ExternalPublicationEventKind,
  ExternalPublicationReceiptRequest,
  ExternalPublicationReceiptResult,
} from "./garpaExternalPublication";
import type {
  CommonsSeededPublicRegistryRequest,
  CommonsSeededPublicRegistryResult,
} from "./garpaCommonsSeededPublicRegistry";

export interface CommonsSeededExternalPublicationEnvelope {
  schemaVersion: 1;
  externalPublicationReceiptId: string;
  caseId: string;
  releaseId: string;
  releaseNumber: 1;
  releaseManifestDigest: string;
  releaseBundleDigest: string;
  seededPublicRegistryResultDigest: string;
  registryEntryDigest: string;
  externalPublicationRequestDigest: string;
  externalPublicationReceiptDigest: string;
  externalArtifactSetDigest: string;
  ordinaryReceiptResultDigest: string;
  evidenceClass: ExternalPublicationEvidenceClass;
  eventKind: ExternalPublicationEventKind;
  observedAt: string;
  syntheticQualificationOnly: boolean;
  externalEventObserved: boolean;
  publicRegistryPublished: boolean;
  publicReleaseOccurred: boolean;
  deploymentAuthorityClaimed: false;
  unrestrictedEquivalenceClaimed: false;
  envelopeDigest: string;
}

export interface CommonsSeededExternalPublicationRequest {
  schemaVersion: 1;
  seededPublicRegistryRequest: CommonsSeededPublicRegistryRequest;
  expectedSeededPublicRegistryResultDigest: string;
  externalPublicationRequest: ExternalPublicationReceiptRequest;
  publicationEnvelope: CommonsSeededExternalPublicationEnvelope;
  admittedAt: string;
}

export type CommonsSeededExternalPublicationFindingState =
  | "public_registry_result_mismatch"
  | "public_registry_record_not_admitted"
  | "public_registry_entry_missing"
  | "external_publication_request_digest_mismatch"
  | "external_publication_envelope_digest_mismatch"
  | "external_publication_case_mismatch"
  | "external_publication_release_mismatch"
  | "external_publication_registry_entry_mismatch"
  | "external_publication_time_order_invalid"
  | "ordinary_external_publication_receipt_failed"
  | "ordinary_external_publication_result_digest_mismatch"
  | "external_publication_event_state_mismatch"
  | "deployment_authority_attempted"
  | "unrestricted_equivalence_attempted"
  | "external_publication_validation_failed";

export interface CommonsSeededExternalPublicationFinding {
  state: CommonsSeededExternalPublicationFindingState;
  artifactId?: string;
  reason: string;
  requiredAction: string;
}

export type CommonsSeededExternalPublicationState =
  | "seeded_external_publication_blocked"
  | "seeded_external_publication_incomplete"
  | "seeded_external_publication_admitted";

export interface CommonsSeededExternalPublicationResult {
  passed: boolean;
  state: CommonsSeededExternalPublicationState;
  receiptAdmitted: boolean;
  externalEventObserved: boolean;
  evidenceClass?: ExternalPublicationEvidenceClass;
  eventKind?: ExternalPublicationEventKind;
  syntheticQualificationOnly: boolean;
  publicRegistryPublished: boolean;
  publicReleaseOccurred: boolean;
  seededPublicRegistryResult?: CommonsSeededPublicRegistryResult;
  seededPublicRegistryResultDigest: string;
  registryEntryDigest: string;
  externalPublicationRequestDigest: string;
  externalPublicationReceiptDigest: string;
  externalArtifactSetDigest: string;
  publicationEnvelopeDigest: string;
  ordinaryReceiptResultDigest: string;
  ordinaryReceiptResult?: ExternalPublicationReceiptResult;
  findings: CommonsSeededExternalPublicationFinding[];
  validationErrors: string[];
  pullList: string[];
  prohibitedTransitions: string[];
}
