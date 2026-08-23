export type AcceptedArtifactKind =
  | "plain_text"
  | "markdown"
  | "html"
  | "web_snapshot"
  | "pdf"
  | "image"
  | "audio"
  | "video"
  | "transcript"
  | "presentation"
  | "spreadsheet"
  | "source_repository"
  | "archive"
  | "other";

export type GarpaCaseStage =
  | "intake"
  | "extraction"
  | "claims"
  | "evidence"
  | "mission_outcome"
  | "capability_graph"
  | "components"
  | "architecture"
  | "qualification"
  | "build"
  | "testing"
  | "evaluation"
  | "publication";

export type GarpaCaseState =
  | "created"
  | "intake_complete"
  | "extraction_complete"
  | "claim_packet_candidate"
  | "claim_packet_valid"
  | "evidence_blocked"
  | "goal_blocked"
  | "goal_admitted"
  | "capability_graph_blocked"
  | "capability_graph_admitted"
  | "component_evidence_blocked"
  | "architecture_blocked"
  | "architecture_candidate"
  | "qualification_blocked"
  | "qualification_frozen"
  | "build_in_progress"
  | "build_assembled"
  | "test_blocked"
  | "testing_in_progress"
  | "testing_complete"
  | "evaluation_complete"
  | "publication_blocked"
  | "publication_ready"
  | "superseded"
  | "withdrawn";

export interface ArtifactEnvelope {
  schemaVersion: 1;
  artifactId: string;
  originalFilename?: string;
  storedFilename: string;
  kind: AcceptedArtifactKind;
  mimeType?: string;
  byteLength: number;
  sha256: string;
  sourceUri?: string;
  capturedAt: string;
  declaredTitle?: string;
  declaredAuthor?: string;
  declaredPublisher?: string;
  declaredDate?: string;
  extractionState:
    | "not_started"
    | "complete"
    | "partial"
    | "failed"
    | "unsupported";
  safetyState:
    | "not_inspected"
    | "passive_content"
    | "active_content_removed"
    | "quarantined";
  notes: string[];
}

export interface ExtractedBlock {
  id: string;
  text: string;
  startLine?: number;
  endLine?: number;
  page?: number;
  slide?: number;
  sheet?: string;
  cellRange?: string;
  timestampStart?: string;
  timestampEnd?: string;
  extractionMethod:
    | "native_text"
    | "document_parser"
    | "speech_to_text"
    | "vision_model"
    | "ocr"
    | "manual";
  confidence?: number;
}

export interface ArtifactExtraction {
  schemaVersion: 1;
  artifactId: string;
  adapterId: string;
  adapterVersion: string;
  textBlocks: ExtractedBlock[];
  metadata: Record<string, string>;
  warnings: string[];
  failures: string[];
  extractionDigest: string;
}

export interface GarpaCaseIndex {
  schemaVersion: 1;
  caseId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  currentState: GarpaCaseState;
  currentStage: GarpaCaseStage;
  artifactIds: string[];
  stageReceiptIds: string[];
  latestDigests: Partial<Record<GarpaCaseStage, string>>;
}

export interface StageReceipt {
  schemaVersion: 1;
  receiptId: string;
  caseId: string;
  stage: GarpaCaseStage;
  predecessorReceiptIds: string[];
  inputDigests: string[];
  action:
    | "extract"
    | "model_generate"
    | "validate"
    | "gate"
    | "retrieve"
    | "render"
    | "manual_review";
  toolId: string;
  toolVersion: string;
  outputPaths: string[];
  outputDigests: string[];
  state: "admitted" | "blocked" | "review_required" | "failed" | "superseded";
  blockingReasons: string[];
  nextActions: string[];
  startedAt: string;
  completedAt: string;
}
