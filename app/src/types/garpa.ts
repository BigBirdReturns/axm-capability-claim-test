import type { EvidenceClass } from "./audit";

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
  notes?: string[];
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
  | "advertised_outcome"
  | "claimed_mechanism"
  | "deployment_occurred"
  | "performance_observed"
  | "cost_observed"
  | "operating_environment"
  | "system_boundary"
  | "independent_verification"
  | "local_result"
  | "component_identity"
  | "component_performance"
  | "component_compatibility"
  | "component_price"
  | "component_availability"
  | "component_license"
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
  subjectVersion?: string;
  hardware?: string[];
  software?: string[];
  fixture?: string;
  environment?: string;
  metric?: string;
  method?: string;
  scopeCompleteness?: "complete" | "partial" | "unknown";
  supports: string[];
  limitations: string[];
  conflictsWith?: string[];
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
  field: string;
  statement: string;
  target: EvidenceTarget;
  evidenceClass: EvidenceClass;
  evidenceCellIds: string[];
  scope?: string;
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

export interface EvidenceBoundValue<T> {
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
  threshold?: number | string | boolean;
  lowerBound?: number;
  upperBound?: number;
  baseline?: number | string | boolean;
  basis: BasisState;
  evidenceCellIds: string[];
  limitations: string[];
}

export interface MissionOutcome {
  schemaVersion: 1;
  operator: EvidenceBoundValue<string>;
  protectedOrAffectedObject: EvidenceBoundValue<string>;
  problemOrThreat: EvidenceBoundValue<string>;
  desiredStateChange: EvidenceBoundValue<string>;
  operatingEnvironment: EvidenceBoundValue<string>;
  timeAndCoverageRequirement: EvidenceBoundValue<string>;
  successMetrics: OutcomeMetric[];
  economicConstraint?: EvidenceBoundValue<string>;
  exclusions: string[];
}

export type OfferingEvidenceGateState =
  | "insufficient_identity"
  | "version_unresolved"
  | "claim_only"
  | "environment_unresolved"
  | "system_boundary_missing"
  | "admitted_for_goal";

export interface EvidenceDisqualification {
  evidenceCellId: string;
  claimId: string;
  field: string;
  reason: string;
}

export interface OfferingEvidenceGateResult {
  state: OfferingEvidenceGateState;
  passed: boolean;
  admittedFields: string[];
  claimedOnlyFields: string[];
  missingFields: string[];
  disqualifiedCells: EvidenceDisqualification[];
  pullList: string[];
}

export type GoalGateState =
  | "goal_ambiguous"
  | "success_metric_missing"
  | "baseline_missing"
  | "admitted_for_decomposition";

export interface GoalGateResult {
  state: GoalGateState;
  passed: boolean;
  admittedFields: string[];
  missingFields: string[];
  rejectedMetricIds: string[];
  missingBaselineMetricIds: string[];
  pullList: string[];
}

export type GarpaAdmissionState =
  | "offering_blocked"
  | "goal_blocked"
  | "admitted_for_decomposition";

export interface GarpaAdmissionResult {
  state: GarpaAdmissionState;
  passed: boolean;
  offeringGate: OfferingEvidenceGateResult;
  goalGate: GoalGateResult;
  doctrine: string;
}

export interface GarpaValidationResult<T> {
  ok: boolean;
  errors: string[];
  value?: T;
}
