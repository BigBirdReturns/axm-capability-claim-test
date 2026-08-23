export type QualificationVenueClass =
  | "simulation"
  | "recorded_replay"
  | "bench"
  | "controlled_field"
  | "operational";

export interface QualificationInstrumentation {
  id: string;
  name: string;
  modelOrVersion: string;
  quantitiesMeasured: string[];
  samplingRate?: string;
  accuracy?: string;
  clockSource: string;
  calibrationState: "current" | "expired" | "not_required" | "unknown";
  calibrationEvidenceIds: string[];
  dataFormat: string;
  storagePath: string;
}

export interface QualificationScenario {
  id: string;
  name: string;
  purpose: string;
  venueClass: QualificationVenueClass;
  protectedOrAffectedObject: string;
  inputOrThreatProfile: string[];
  environment: Record<string, string>;
  duration: string;
  coverageGeometry: string;
  loadProfile: string;
  concurrencyProfile: string;
  operatorConditions: {
    staffing: string;
    training: string;
    priorKnowledge: string;
    permittedIntervention: string[];
  };
  degradedConditions: string[];
  excludedConditions: string[];
  fixtureIds: string[];
  metricIds: string[];
  instrumentationIds: string[];
  authorizationId?: string;
  activeEffect: boolean;
  evidenceCellIds: string[];
  assumptions: string[];
}

export type QualificationMetricCriticality =
  | "essential"
  | "secondary"
  | "diagnostic";

export interface QualificationMetric {
  id: string;
  missionMetricIds: string[];
  riskIds: string[];
  residualIds: string[];
  name: string;
  criticality: QualificationMetricCriticality;
  quantity: string;
  unit?: string;
  direction:
    | "higher_is_better"
    | "lower_is_better"
    | "inside_range"
    | "boolean"
    | "categorical";
  threshold?: number | string | boolean;
  lowerBound?: number;
  upperBound?: number;
  baseline?: number | string | boolean;
  measurementMethod: string;
  instrumentationIds: string[];
  samplingMethod: string;
  requiredRuns: number;
  aggregation:
    | "all_runs"
    | "minimum"
    | "maximum"
    | "mean"
    | "median"
    | "percentile"
    | "proportion";
  aggregationParameter?: number;
  allowedUncertainty: string;
  failureCondition: string;
  evidenceCellIds: string[];
  limitations: string[];
}

export interface QualificationComparator {
  id: string;
  type:
    | "no_system"
    | "current_manual_process"
    | "incumbent_system"
    | "vendor_offering"
    | "customer_requirement"
    | "prior_garpa_build";
  name: string;
  version?: string;
  scenarioIds: string[];
  metricIds: string[];
  resultEvidenceCellIds: string[];
  comparability:
    | "same_fixture"
    | "normalized"
    | "reported_only"
    | "not_comparable";
  limitations: string[];
}

export interface QualificationAccountingBoundary {
  currency: string;
  evaluationPeriod: string;
  includedCategories: string[];
  excludedCategories: string[];
  missionDenominator: string;
}

export interface QualificationAuthorization {
  id: string;
  venueClass: QualificationVenueClass;
  ownerOrController: string;
  permittedActivities: string[];
  prohibitedActivities: string[];
  requiredAuthorizations: string[];
  receivedAuthorizationRefs: string[];
  abortAuthority: string[];
  geographicBoundary?: string;
  timeBoundary?: string;
  evidenceCellIds: string[];
  state: "admitted" | "not_required" | "blocked" | "unresolved";
  rationale: string;
}

export interface QualificationAcceptanceRule {
  allEssentialMustPass: boolean;
  allowInconclusiveEssential: boolean;
  minimumValidRunsPerMetric: number;
  missingDataDisposition: "fail" | "inconclusive";
  invalidRunDisposition: "exclude_with_receipt" | "fail";
  secondaryMetricsCanOffsetEssentialFailure: boolean;
}

export interface QualificationContract {
  schemaVersion: 1;
  caseId: string;
  missionOutcomeDigest: string;
  capabilityGraphDigest: string;
  candidateArchitectureDigest: string;
  scenarios: QualificationScenario[];
  metrics: QualificationMetric[];
  instrumentation: QualificationInstrumentation[];
  comparators: QualificationComparator[];
  accountingBoundary: QualificationAccountingBoundary;
  authorizations: QualificationAuthorization[];
  acceptanceRule: QualificationAcceptanceRule;
  frozenAt: string;
  supersedesDigest?: string;
  state: "candidate" | "frozen" | "superseded";
}

export type QualificationGateState =
  | "architecture_not_admitted"
  | "upstream_digest_mismatch"
  | "mission_metric_coverage_incomplete"
  | "scenario_coverage_incomplete"
  | "instrumentation_incomplete"
  | "threshold_or_baseline_mismatch"
  | "risk_or_residual_test_missing"
  | "comparator_incomplete"
  | "accounting_boundary_mismatch"
  | "authorization_missing"
  | "acceptance_rule_invalid"
  | "contract_not_frozen"
  | "admitted_for_build_manifest";

export interface QualificationGateResult {
  state: QualificationGateState;
  passed: boolean;
  uncoveredMissionMetricIds: string[];
  uncoveredQualificationMetricIds: string[];
  scenarioMetricFindings: string[];
  instrumentationFindings: string[];
  thresholdFindings: string[];
  missingRiskTestIds: string[];
  missingResidualTestIds: string[];
  comparatorFindings: string[];
  accountingFindings: string[];
  authorizationFindings: string[];
  acceptanceFindings: string[];
  pullList: string[];
}
