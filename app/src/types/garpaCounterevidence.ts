export type SubmitterRelationship =
  | "public"
  | "customer"
  | "vendor"
  | "investor"
  | "employee"
  | "researcher"
  | "operator"
  | "unknown";

export interface CounterevidenceSubmitter {
  name?: string;
  organization?: string;
  relationshipToSubject: SubmitterRelationship;
}

export interface CounterevidencePacket {
  schemaVersion: 1;
  packetId: string;
  targetCaseId: string;
  targetReleaseId: string;
  targetReleaseDigest: string;
  targetClaimIds: string[];
  submitter: CounterevidenceSubmitter;
  artifactIds: string[];
  evidenceCellIds: string[];
  requestedCorrection: string;
  submittedAt: string;
}

export type CounterevidenceClaimEffect =
  | "supports"
  | "narrows"
  | "contradicts"
  | "requires_requalification"
  | "new_offering_version"
  | "no_effect";

export interface CounterevidenceClaimAssessment {
  claimId: string;
  effect: CounterevidenceClaimEffect;
  evidenceCellIds: string[];
  reason: string;
}

export interface CounterevidenceReviewRequest {
  schemaVersion: 1;
  packet: CounterevidencePacket;
  currentReleaseId: string;
  currentReleaseDigest: string;
  currentReleaseNumber: number;
  currentReleaseState: "current" | "superseded" | "withdrawn";
  knownClaimIds: string[];
  validatedEvidenceCellIds: string[];
  duplicateEvidenceCellIds: string[];
  rejectedEvidenceCellIds: string[];
  claimAssessments: CounterevidenceClaimAssessment[];
  reviewedAt: string;
  reviewer: string;
}

export type CounterevidenceDisposition =
  | "target_release_stale"
  | "insufficient"
  | "duplicative"
  | "supports_current_release"
  | "narrows_current_release"
  | "contradicts_current_release"
  | "requires_requalification"
  | "requires_new_case_version";

export type CounterevidenceAction =
  | "resolve_current_release"
  | "no_change"
  | "record_support"
  | "prepare_superseding_release"
  | "reopen_qualification"
  | "open_new_case_version";

export interface CounterevidenceReviewResult {
  packetId: string;
  targetCaseId: string;
  targetReleaseId: string;
  disposition: CounterevidenceDisposition;
  action: CounterevidenceAction;
  accepted: boolean;
  supersessionRequired: boolean;
  affectedClaimIds: string[];
  validatedEvidenceCellIds: string[];
  duplicateEvidenceCellIds: string[];
  rejectedEvidenceCellIds: string[];
  preserveTargetRelease: true;
  requiredActions: string[];
  controlQuestion: string;
}

export interface SupersessionReceipt {
  schemaVersion: 1;
  receiptId: string;
  caseId: string;
  counterevidencePacketId: string;
  supersededReleaseId: string;
  supersededReleaseDigest: string;
  supersededReleaseNumber: number;
  candidateSuccessorReleaseId: string;
  candidateSuccessorReleaseNumber: number;
  changedClaimIds: string[];
  reason: string;
  requiredUpstreamActions: string[];
  createdAt: string;
  state: "candidate" | "issued";
}
