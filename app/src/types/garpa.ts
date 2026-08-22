import type { Ledger, SourcingGateResult } from "./audit";

export type OfferingClaimField =
  | "offering_identity"
  | "offering_version"
  | "advertised_outcome"
  | "claimed_mechanism"
  | "advertised_economics"
  | "named_operator_need"
  | "deployment_record"
  | "measured_performance"
  | "economic_baseline"
  | "operating_environment"
  | "system_boundary"
  | "independent_verification"
  | "ownership_and_lock_in";

export type ArtifactKind =
  | "social_post"
  | "web_page"
  | "article"
  | "pitch_deck"
  | "datasheet"
  | "procurement_record"
  | "contract_record"
  | "patent"
  | "paper"
  | "benchmark"
  | "video"
  | "transcript"
  | "image"
  | "local_test"
  | "other";

export interface ArtifactRef {
  id: string;
  kind: ArtifactKind;
  title: string;
  uri?: string;
  publisher?: string;
  author?: string;
  publishedAt?: string;
  capturedAt: string;
  contentDigest?: string;
  exactVersion?: string;
  notes?: string;
}

export interface ArtifactLocator {
  artifactId: string;
  page?: number;
  timestampStart?: string;
  timestampEnd?: string;
  section?: string;
  quotedText?: string;
  description?: string;
}

export type EvidenceTarget =
  | "claim_was_made"
  | "offering_identity"
  | "offering_version"
  | "operator_need"
  | "deployment_occurred"
  | "performance_observed"
  | "cost_observed"
  | "system_boundary"
  | "ownership_or_lock_in"
  | "local_result"
  | "other";

export type EvidenceVenue =
  | "claimant_publication"
  | "customer_publication"
  | "government_record"
  | "independent_test"
  | "published_benchmark"
  | "journalistic_report"
  | "community_report"
  | "local_reproduction"
  | "analyst_derivation";

export type EvidenceControl =
  | "claimant_controlled"
  | "commercially_related"
  | "externally_attributed"
  | "independent"
  | "local_measured"
  | "unknown";

export interface EvidenceCell {
  id: string;
  target: EvidenceTarget;
  venue: EvidenceVenue;
  control: EvidenceControl;
  locator: ArtifactLocator;
  statement: string;
  subjectVersion?: string;
  fixture?: string;
  environment?: string;
  metric?: string;
  method?: string;
  limitations: string[];
}

export interface OfferingSubject {
  claimant: string;
  organization?: string;
  offering: string;
  offeringVersion?: string;
  offeringType:
    | "product"
    | "service"
    | "system"
    | "platform"
    | "program"
    | "architecture";
}

export type ClaimLifecycle =
  | "active"
  | "superseded"
  | "withdrawn"
  | "conflicted"
  | "unknown";

export interface ScopedOfferingClaim {
  id: string;
  field: OfferingClaimField;
  target: EvidenceTarget;
  statement: string;
  scope?: string;
  evidenceCellIds: string[];
  lifecycle: ClaimLifecycle;
  limitations: string[];
}

export interface ClaimConflict {
  id: string;
  claimIds: string[];
  description: string;
}

export interface ClaimPacket {
  schemaVersion: 1;
  subject: OfferingSubject;
  artifacts: ArtifactRef[];
  evidence: EvidenceCell[];
  claims: ScopedOfferingClaim[];
  conflicts: ClaimConflict[];
  capturedAt: string;
}

export type BasisState =
  | "explicitly_stated"
  | "externally_supported"
  | "derived"
  | "analyst_hypothesis"
  | "open";

export interface EvidenceBoundValue<T = string> {
  value?: T;
  basis: BasisState;
  evidenceCellIds: string[];
  limitations: string[];
}

export interface OutcomeMetric {
  id: string;
  name: string;
  unit?: string;
  comparator: "gte" | "lte" | "range" | "boolean" | "categorical";
  threshold?: number | string;
  baseline?: number | string;
  basis: BasisState;
  evidenceCellIds: string[];
  limitations: string[];
}

export interface MissionOutcome {
  schemaVersion: 1;
  operator: EvidenceBoundValue;
  protectedOrAffectedObject: EvidenceBoundValue;
  problemOrThreat: EvidenceBoundValue;
  desiredStateChange: EvidenceBoundValue;
  operatingEnvironment: EvidenceBoundValue;
  timeAndCoverageRequirement: EvidenceBoundValue;
  baseline: EvidenceBoundValue;
  successMetrics: OutcomeMetric[];
  economicConstraint?: EvidenceBoundValue;
  exclusions: string[];
}

export interface ClaimPacketValidationResult {
  ok: boolean;
  errors: string[];
  claimPacket?: ClaimPacket;
}

export interface MissionOutcomeValidationResult {
  ok: boolean;
  errors: string[];
  missionOutcome?: MissionOutcome;
}

export interface OfferingEvidenceGateResult {
  passed: boolean;
  architecturePreconditionsPassed: boolean;
  admittedFields: OfferingClaimField[];
  claimedOnlyFields: OfferingClaimField[];
  missingFields: OfferingClaimField[];
  blockingReasons: string[];
  pullList: string[];
}

export type GoalGateState =
  | "admitted_for_architecture"
  | "goal_ambiguous"
  | "environment_unresolved"
  | "baseline_unresolved"
  | "success_metric_missing"
  | "time_and_coverage_unresolved"
  | "invalid";

export interface GoalGateResult {
  passed: boolean;
  state: GoalGateState;
  admittedFields: string[];
  missingFields: string[];
  blockingReasons: string[];
  pullList: string[];
}

export type GarpaAdmissionStage =
  | "invalid"
  | "claim_packet"
  | "goal_hypothesis"
  | "architecture";

export type GarpaAdmissionResult =
  | {
      ok: false;
      admittedThrough: "invalid";
      errors: string[];
    }
  | {
      ok: true;
      admittedThrough: Exclude<GarpaAdmissionStage, "invalid">;
      architectureReady: boolean;
      claimPacket: ClaimPacket;
      ledger: Ledger;
      sourcingGate: SourcingGateResult;
      offeringEvidenceGate: OfferingEvidenceGateResult;
      missionOutcome?: MissionOutcome;
      goalGate?: GoalGateResult;
      blockingReasons: string[];
      pullList: string[];
    };
