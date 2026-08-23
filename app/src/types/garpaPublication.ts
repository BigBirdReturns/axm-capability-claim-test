import type { ArtifactLocator } from "./garpa";
import type { MissionEvaluation } from "./garpaEvaluation";

export type PublicationClaimClass =
  | "source_attribution"
  | "evidence_summary"
  | "local_measurement"
  | "bounded_inference"
  | "mission_evaluation"
  | "cost_comparison"
  | "vendor_parity"
  | "residual"
  | "open_question";

export type SupportRelation =
  | "direct_source"
  | "derived_from"
  | "measured_by"
  | "evaluated_by"
  | "costed_by"
  | "limited_by"
  | "contradicted_by";

export interface ClaimSupportRef {
  relation: SupportRelation;
  artifactId?: string;
  evidenceCellId?: string;
  stageReceiptId?: string;
  runReceiptId?: string;
  evaluationDigest?: string;
  costLineIds?: string[];
  locator?: ArtifactLocator;
  note: string;
}

export interface PublicationClaimScope {
  offeringVersion?: string;
  buildDigest?: string;
  scenarioIds?: string[];
  metricIds?: string[];
  environment?: string;
  evaluationPeriod?: string;
  accountingBoundaryComplete?: boolean;
}

export interface PublicationClaim {
  id: string;
  caseId: string;
  text: string;
  claimClass: PublicationClaimClass;
  subject: string;
  scope: PublicationClaimScope;
  supportRefs: ClaimSupportRef[];
  limitations: string[];
  prohibitedGeneralizations: string[];
  state: "candidate" | "supported" | "blocked" | "superseded";
}

export type CaseDisposition =
  | "acquire"
  | "compose"
  | "develop"
  | "experiment"
  | "wait_for_evidence"
  | "decline"
  | "unresolved";

export type ReleaseAudience = "public" | "research" | "controlled" | "internal";

export type RightsClass =
  | "redistributable"
  | "public_domain"
  | "open_license"
  | "quotation_only"
  | "citation_only"
  | "permission_required"
  | "restricted"
  | "unknown";

export interface ArtifactRights {
  artifactId: string;
  rightsClass: RightsClass;
  license?: string;
  rightsHolder?: string;
  permittedUses: string[];
  prohibitedUses: string[];
  evidenceArtifactIds: string[];
}

export interface ArtifactReleaseDecision {
  artifactId: string;
  releaseForm: "full" | "excerpt" | "citation" | "digest_only" | "withheld";
  rationale: string;
}

export type RightsReviewState =
  | "clear"
  | "clear_with_citation_only"
  | "clear_with_restrictions"
  | "permission_required"
  | "blocked";

export interface RightsReview {
  state: RightsReviewState;
  artifactDecisions?: Array<{
    artifactId: string;
    rightsClass: RightsClass;
    includedInRelease: boolean;
    note: string;
  }>;
  findings?: Array<{
    id: string;
    artifactId?: string;
    finding: string;
    requiredAction: string;
  }>;
  reviewedAt: string;
  reviewer: string;
}

export type PublicationSafetyState =
  | "clear"
  | "clear_with_redactions"
  | "controlled_release_only"
  | "blocked";

export interface PublicationSafetyReview {
  state: PublicationSafetyState;
  findings: Array<{
    id: string;
    affectedClaimIds: string[];
    affectedArtifactIds: string[];
    risk: string;
    requiredAction: string;
  }>;
  reviewedAt: string;
  reviewer: string;
}

export interface RedactionDecision {
  id: string;
  claimId?: string;
  artifactId?: string;
  reason:
    | "personal_information"
    | "security_sensitive_configuration"
    | "operational_vulnerability"
    | "restricted_source"
    | "third_party_secret"
    | "safety_sensitive_procedure"
    | "legal_restriction"
    | "other";
  removedContentDescription: string;
  publicReplacement?: string;
  evidentiaryEffect:
    | "none"
    | "narrows_claim"
    | "blocks_claim"
    | "requires_controlled_release";
  decidedBy: string;
  decidedAt: string;
}

export type VendorParityState =
  | "same_fixture_match"
  | "same_fixture_miss"
  | "evidence_only_comparison"
  | "vendor_baseline_missing"
  | "scenario_mismatch"
  | "accounting_boundary_mismatch"
  | "incomparable"
  | "not_attempted";

export interface PublicationUpstream {
  claimReportDigest: string;
  currentClaimReportDigest?: string;
  missionEvaluationDigest?: string;
  currentMissionEvaluationDigest?: string;
  missionEvaluationState?:
    | "matched"
    | "bounded_match"
    | "partial"
    | "failed"
    | "incomparable"
    | "unassessed";
  vendorParityDigest?: string;
  currentVendorParityDigest?: string;
  vendorParityState?: VendorParityState;
  accountingComparability?:
    | "aligned"
    | "partially_aligned"
    | "misaligned"
    | "not_supplied";
}

export interface PublicationPackage {
  schemaVersion: 1;
  caseId: string;
  releaseCandidateId: string;
  subject: string;
  caseIndexDigest: string;
  upstreamDigests: Record<string, string>;
  disposition: CaseDisposition;
  vendorParityState: VendorParityState;
  claims: PublicationClaim[];
  audience: ReleaseAudience;
  rightsReview: RightsReview;
  safetyReview: PublicationSafetyReview;
  redactions: RedactionDecision[];
  preparedAt: string;
  preparedBy: string;
  upstream?: PublicationUpstream;
  artifactRights?: ArtifactRights[];
  artifactReleaseDecisions?: ArtifactReleaseDecision[];
  knownFailureIds?: string[];
  disclosedFailureIds?: string[];
  knownContradictionIds?: string[];
  disclosedContradictionIds?: string[];
  correctionContact?: string;
}

export interface PublicationCompilationInput {
  caseId: string;
  subject: string;
  offeringVersion?: string;
  missionEvaluationDigest: string;
  missionEvaluationState:
    | "matched"
    | "bounded_match"
    | "partial"
    | "failed"
    | "incomparable"
    | "unassessed";
  missionBuildDigest: string;
  missionScenarioIds: string[];
  missionMetricIds: string[];
  missionResiduals: string[];
  missionRunReceiptIds: string[];
  vendorParityDigest?: string;
  vendorParityState?: VendorParityState;
  vendorOffering?: string;
  vendorVersion?: string;
  matchedParityMetricIds?: string[];
  parityScopeBoundary?: string;
}

export type PublicationGateState =
  | "claim_support_incomplete"
  | "scope_overstated"
  | "cost_boundary_misaligned"
  | "vendor_parity_unsupported"
  | "rights_unresolved"
  | "safety_review_blocked"
  | "redaction_invalidates_claim"
  | "upstream_receipt_stale"
  | "publication_ready";

export interface PublicationFinding {
  claimId?: string;
  state: Exclude<PublicationGateState, "publication_ready">;
  reason: string;
}

export interface PublicationGateResult {
  passed: boolean;
  state: PublicationGateState;
  admittedClaimIds: string[];
  blockedClaimIds: string[];
  narrowedClaimIds: string[];
  findings: PublicationFinding[];
  requiredActions: string[];
}

export interface MissionPublicationInput {
  subject: string;
  evaluationDigest: string;
  evaluation: MissionEvaluation;
  scenarioIds: string[];
  metricIds: string[];
}
