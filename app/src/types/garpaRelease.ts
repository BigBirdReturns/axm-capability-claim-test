import type { PublicationGateResult } from "./garpaPublication";

export interface ReleaseFileEntry {
  path: string;
  sha256: string;
  byteLength: number;
  mediaType?: string;
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
  files: ReleaseFileEntry[];
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

export interface ReleaseVerificationResult {
  passed: boolean;
  releaseId: string;
  publicationAdmitted: boolean;
  missingFiles: string[];
  unexpectedFiles: string[];
  hashMismatches: string[];
  lengthMismatches: string[];
  duplicateManifestPaths: string[];
  blockingReasons: string[];
}
