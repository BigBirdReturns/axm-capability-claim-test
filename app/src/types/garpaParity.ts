import type { EvidenceControl } from "./garpa";
import type { MissionAdequacyState } from "./garpaExecution";

export type ParityMetricDirection =
  | "higher_is_better"
  | "lower_is_better"
  | "absolute_delta"
  | "boolean_equal"
  | "categorical_equal";

export interface ParityMetricComparator {
  metricId: string;
  label: string;
  essential: boolean;
  direction: ParityMetricDirection;
  requiredUnit?: string;
  absoluteTolerance?: number;
  relativeTolerance?: number;
  requiresAccountingAlignment?: boolean;
}

export type ParitySubject = "garpa" | "vendor";

export interface ParityMetricObservation {
  id: string;
  subject: ParitySubject;
  subjectVersion?: string;
  metricId: string;
  scenarioId: string;
  fixtureDigest?: string;
  methodDigest?: string;
  buildReceiptDigest?: string;
  qualificationContractDigest?: string;
  value: number | string | boolean;
  unit?: string;
  evidenceControl: EvidenceControl;
  evidenceArtifactIds: string[];
  limitations: string[];
}

export type ScenarioComparability =
  | "same_fixture"
  | "normalized"
  | "reported_only"
  | "not_comparable";

export interface ScenarioComparison {
  id: string;
  garpaScenarioId: string;
  vendorScenarioId: string;
  state: ScenarioComparability;
  normalizationMethod?: string;
  reasons: string[];
}

export type AccountingCostCategory =
  | "hardware"
  | "software"
  | "services"
  | "custom_code"
  | "fabrication"
  | "integration_labor"
  | "operator_labor"
  | "training"
  | "test_equipment"
  | "qualification"
  | "maintenance"
  | "spares"
  | "communications"
  | "facilities"
  | "energy"
  | "regulatory"
  | "replacement"
  | "contingency";

export interface AccountingBoundary {
  id: string;
  subject: ParitySubject;
  currency: string;
  priceDate: string;
  evaluationPeriod: string;
  includes: AccountingCostCategory[];
  exclusions: string[];
  missionDenominator: string;
  evidenceArtifactIds: string[];
}

export type AccountingComparability =
  | "aligned"
  | "partially_aligned"
  | "misaligned"
  | "not_supplied";

export interface AccountingBoundaryComparison {
  garpaBoundaryId?: string;
  vendorBoundaryId?: string;
  state: AccountingComparability;
  reasons: string[];
}

export interface VendorParityRequest {
  schemaVersion: 1;
  caseId: string;
  vendorOffering: string;
  vendorVersion?: string;
  garpaMissionState: MissionAdequacyState;
  garpaBuildReceiptDigest: string;
  garpaQualificationContractDigest: string;
  requiredMetricIds: string[];
  essentialMetricIds: string[];
  comparators: ParityMetricComparator[];
  observations: ParityMetricObservation[];
  scenarioComparisons: ScenarioComparison[];
  accountingBoundaries: AccountingBoundary[];
  accountingComparison?: AccountingBoundaryComparison;
}

export type MetricParityState =
  | "match"
  | "miss"
  | "missing"
  | "incomparable";

export interface MetricParityResult {
  metricId: string;
  label: string;
  essential: boolean;
  state: MetricParityState;
  garpaObservationId?: string;
  vendorObservationId?: string;
  garpaValue?: number | string | boolean;
  vendorValue?: number | string | boolean;
  unit?: string;
  allowedTolerance?: number;
  reason: string;
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

export interface VendorParityEvaluation {
  caseId: string;
  vendorOffering: string;
  vendorVersion?: string;
  garpaBuildReceiptDigest: string;
  garpaQualificationContractDigest: string;
  state: VendorParityState;
  metricResults: MetricParityResult[];
  matchedMetricIds: string[];
  missedMetricIds: string[];
  incomparableMetricIds: string[];
  supportedParityClaims: string[];
  unsupportedParityClaims: string[];
  largestGap: string;
  whatWouldResolveIt: string;
  scopeBoundary: string;
  falsificationLine: string;
}
