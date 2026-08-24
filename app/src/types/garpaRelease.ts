import type { PublicationGateResult } from "./garpaPublication";

export type ReleaseFileRole =
  | "release_metadata"
  | "manifest"
  | "reality_brief"
  | "public_dossier"
  | "publication_claims"
  | "support_graph"
  | "source_ledger"
  | "engineering_summary"
  | "mission_evaluation"
  | "vendor_parity"
  | "metric_results"
  | "cost_ledger"
  | "failure_register"
  | "residual_register"
  | "gate_receipt"
  | "rights_receipt"
  | "safety_receipt"
  | "redaction_receipt"
  | "asset"
  | "other";

export interface ReleaseFileRecord {
  path: string;
  sha256: string;
  byteLength: number;
  mediaType?: string;
  role?: ReleaseFileRole;
  required?: boolean;
}

export interface ReleaseFileEntry extends ReleaseFileRecord {
  required: boolean;
}

export interface GarpaReleaseManifest {
  schemaVersion: 1;
  releaseId: string;
  caseId: string;
  releaseNumber: number;
  publicationPackageDigest: string;
  publicationGateReceiptDigest: string;
  priorReleaseDigest?: string;
  supersedesReleaseId?: string;
  files: ReleaseFileRecord[];
  manifestDigest: string;
  createdAt: string;
  state: "current" | "superseded" | "withdrawn";
}

export interface ActualReleaseFile {
  sha256: string;
  byteLength: number;
}

export interface ReleaseVerificationInput {
  manifest: GarpaReleaseManifest;
  actualFiles: Record<string, ActualReleaseFile>;
  publicationGate: PublicationGateResult;
}

export interface ReleaseRegistrySnapshot {
  caseId: string;
  currentReleaseId?: string;
  currentReleaseDigest?: string;
  supersededReleaseIds: string[];
  withdrawnReleaseIds: string[];
}

export interface ReleaseVerificationRequest {
  manifest: GarpaReleaseManifest;
  computedManifestDigest: string;
  observedFiles: ReleaseFileRecord[];
  registry?: ReleaseRegistrySnapshot;
}

export type ReleaseVerificationState =
  | "current_valid"
  | "superseded_valid"
  | "withdrawn_valid"
  | "manifest_digest_mismatch"
  | "file_missing"
  | "unexpected_file"
  | "file_digest_mismatch"
  | "file_length_mismatch"
  | "duplicate_path"
  | "unsafe_path"
  | "registry_mismatch";

export interface ReleaseVerificationFinding {
  state: Exclude<
    ReleaseVerificationState,
    "current_valid" | "superseded_valid" | "withdrawn_valid"
  >;
  path?: string;
  reason: string;
}

export interface ReleaseVerificationResult {
  passed: boolean;
  releaseId: string;
  publicationAdmitted?: boolean;
  missingFiles?: string[];
  unexpectedFiles?: string[];
  hashMismatches?: string[];
  lengthMismatches?: string[];
  duplicateManifestPaths?: string[];
  blockingReasons?: string[];
  state?: ReleaseVerificationState;
  caseId?: string;
  findings?: ReleaseVerificationFinding[];
  verifiedFileCount?: number;
  releaseState?: GarpaReleaseManifest["state"];
}
