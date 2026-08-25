export type ExternalPublicationEvidenceClass =
  | "synthetic_qualification"
  | "observed_external";

export type ExternalPublicationEventKind =
  | "registry_entry_published"
  | "release_bundle_distributed";

export type ExternalPublicationChannel =
  | "web"
  | "source_repository_release"
  | "artifact_repository"
  | "other";

export interface ExternalPublicationArtifact {
  artifactId: string;
  sha256: string;
  byteLength: number;
  mediaType: string;
  capturePath: string;
  sourceLocator: string;
  contentEncoding: "utf-8";
  content: string;
  capturedAt: string;
}

export interface ExternalPublicationReceipt {
  schemaVersion: 1;
  receiptId: string;
  caseId: string;
  releaseId: string;
  releaseManifestDigest: string;
  releaseBundleDigest: string;
  registryEntryDigest: string;
  eventKind: ExternalPublicationEventKind;
  evidenceClass: ExternalPublicationEvidenceClass;
  channel: ExternalPublicationChannel;
  publisher: string;
  sourceLocator: string;
  targetContentDigest: string;
  publishedAt: string;
  observedAt: string;
  artifactIds: string[];
  syntheticQualificationOnly: boolean;
  publicRegistryPublished: boolean;
  publicReleaseOccurred: boolean;
  receiptDigest: string;
}

export interface ExternalPublicationReceiptRequest {
  schemaVersion: 1;
  receipt: ExternalPublicationReceipt;
  artifacts: ExternalPublicationArtifact[];
  admittedAt: string;
}

export type ExternalPublicationReceiptFindingState =
  | "receipt_digest_mismatch"
  | "artifact_set_mismatch"
  | "artifact_digest_invalid"
  | "artifact_length_invalid"
  | "artifact_locator_mismatch"
  | "artifact_time_order_invalid"
  | "publication_time_order_invalid"
  | "target_content_digest_mismatch"
  | "synthetic_occurrence_attempted"
  | "synthetic_locator_invalid"
  | "observed_locator_invalid"
  | "observed_occurrence_missing"
  | "event_semantics_mismatch";

export interface ExternalPublicationReceiptFinding {
  state: ExternalPublicationReceiptFindingState;
  artifactId?: string;
  reason: string;
  requiredAction: string;
}

export type ExternalPublicationReceiptState =
  | "external_publication_receipt_blocked"
  | "external_publication_receipt_admitted";

export interface ExternalPublicationReceiptResult {
  passed: boolean;
  state: ExternalPublicationReceiptState;
  evidenceClass: ExternalPublicationEvidenceClass;
  eventKind: ExternalPublicationEventKind;
  eventObserved: boolean;
  syntheticQualificationOnly: boolean;
  publicRegistryPublished: boolean;
  publicReleaseOccurred: boolean;
  receiptDigest: string;
  artifactSetDigest: string;
  artifactIds: string[];
  findings: ExternalPublicationReceiptFinding[];
  pullList: string[];
}
