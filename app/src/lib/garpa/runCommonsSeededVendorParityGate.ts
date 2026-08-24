import type {
  ParityMetricComparator,
  ParityMetricDirection,
} from "../../types/garpaParity";
import type { QualificationMetric } from "../../types/garpaQualification";
import type {
  CommonsSeededVendorParityFinding,
  CommonsSeededVendorParityRequest,
  CommonsSeededVendorParityResult,
} from "../../types/garpaCommonsSeededVendorParity";
import { canonicalStringify } from "./canonicalJson";
import {
  computeCommonsSeededGarpaObservationSetDigest,
  computeCommonsSeededVendorObservationSetDigest,
  computeCommonsSeededVendorParityEnvelopeDigest,
  computeVendorParityRequestDigest,
} from "./commonsSeededVendorParityDigest";
import { computeCommonsSeededMissionEvaluationResultDigest } from "./commonsSeededMissionEvaluationDigest";
import { deriveCommonsSeededGarpaParityObservations } from "./deriveCommonsSeededGarpaParity";
import { runCommonsSeededMissionEvaluationGate } from "./runCommonsSeededMissionEvaluationGate";
import { runVendorParityEvaluation } from "./runVendorParityEvaluation";
import { sha256Hex } from "./sha256";
import { validateCommonsSeededVendorParityRequest } from "./validateCommonsSeededVendorParity";

export const COMMONS_SEEDED_VENDOR_PARITY_PROHIBITED_TRANSITIONS = [
  "Vendor-parity admission records the exact bounded comparison; it does not establish unrestricted product equivalence, deployment authority, or publication authority.",
  "A same-fixture miss, evidence-only comparison, missing vendor baseline, scenario mismatch, accounting mismatch, incomparable result, or not-attempted result remains admissible when its custody is coherent.",
  "No source qualification, vendor claim, favorable metric subset, or selected execution may replace the complete target campaign and exact-version vendor evidence.",
] as const;

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function sorted(values: string[]): string[] {
  return dedupe(values).sort((left, right) => left.localeCompare(right));
}

function exactSet(left: string[], right: string[]): boolean {
  const a = sorted(left);
  const b = sorted(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function addFinding(
  findings: CommonsSeededVendorParityFinding[],
  state: CommonsSeededVendorParityFinding["state"],
  reason: string,
  requiredAction: string,
  coordinates: Partial<CommonsSeededVendorParityFinding> = {},
): void {
  findings.push({ state, reason, requiredAction, ...coordinates });
}

function qualificationOf(request: CommonsSeededVendorParityRequest) {
  return request.seededMissionEvaluationRequest.testRunRequests[0]!
    .seededPreflightRequest.seededBuildReceiptRequest.seededBuildManifestRequest
    .seededQualificationRequest.qualificationContract;
}

function asBuiltOf(request: CommonsSeededVendorParityRequest) {
  return request.seededMissionEvaluationRequest.testRunRequests[0]!
    .seededPreflightRequest.seededBuildReceiptRequest.asBuiltReceipt;
}

function allowedDirection(metric: QualificationMetric): ParityMetricDirection {
  if (metric.direction === "higher_is_better") return "higher_is_better";
  if (metric.direction === "lower_is_better") return "lower_is_better";
  if (metric.direction === "boolean") return "boolean_equal";
  if (metric.direction === "categorical") return "categorical_equal";
  return "absolute_delta";
}

function comparatorMatches(
  metric: QualificationMetric,
  comparator: ParityMetricComparator | undefined,
): boolean {
  if (!comparator) return false;
  if (comparator.essential !== (metric.criticality === "essential")) return false;
  if (comparator.direction !== allowedDirection(metric)) return false;
  if (
    ["higher_is_better", "lower_is_better", "absolute_delta"].includes(
      comparator.direction,
    ) &&
    comparator.requiredUnit !== metric.unit
  ) {
    return false;
  }
  return true;
}

function blockedResult(errors: string[]): CommonsSeededVendorParityResult {
  return {
    passed: false,
    state: "seeded_vendor_parity_blocked",
    seededMissionEvaluationResultDigest: "",
    vendorParityRequestDigest: "",
    parityEnvelopeDigest: "",
    garpaObservationSetDigest: "",
    vendorObservationSetDigest: "",
    vendorParityEvaluationDigest: "",
    derivedGarpaObservations: [],
    vendorObservations: [],
    vendorArtifactIds: [],
    findings: errors.map((reason) => ({
      state: "vendor_parity_validation_failed" as const,
      reason,
      requiredAction:
        "Repair the Commons-seeded vendor-parity request and rerun validation.",
    })),
    validationErrors: errors,
    pullList: errors,
    prohibitedTransitions: [...COMMONS_SEEDED_VENDOR_PARITY_PROHIBITED_TRANSITIONS],
  };
}

export function runCommonsSeededVendorParityGate(
  input: CommonsSeededVendorParityRequest | unknown,
): CommonsSeededVendorParityResult {
  const validated = validateCommonsSeededVendorParityRequest(input);
  if (!validated.ok || !validated.value) return blockedResult(validated.errors);

  const request = validated.value;
  const findings: CommonsSeededVendorParityFinding[] = [];
  const missionResult = runCommonsSeededMissionEvaluationGate(
    request.seededMissionEvaluationRequest,
  );
  const missionResultDigest =
    computeCommonsSeededMissionEvaluationResultDigest(missionResult);
  const parityRequest = request.vendorParityRequest;
  const envelope = request.parityEnvelope;
  const parityRequestDigest = computeVendorParityRequestDigest(parityRequest);
  const envelopeDigest = computeCommonsSeededVendorParityEnvelopeDigest(envelope);
  const qualification = qualificationOf(request);
  const asBuilt = asBuiltOf(request);
  const derivation = deriveCommonsSeededGarpaParityObservations(
    request.seededMissionEvaluationRequest,
    missionResult,
  );
  const requestedGarpaObservations = parityRequest.observations.filter(
    (observation) => observation.subject === "garpa",
  );
  const vendorObservations = parityRequest.observations.filter(
    (observation) => observation.subject === "vendor",
  );
  const derivedGarpaDigest = computeCommonsSeededGarpaObservationSetDigest(
    derivation.observations,
  );
  const requestedGarpaDigest = computeCommonsSeededGarpaObservationSetDigest(
    requestedGarpaObservations,
  );
  const vendorObservationDigest =
    computeCommonsSeededVendorObservationSetDigest(vendorObservations);

  if (
    request.expectedSeededMissionEvaluationResultDigest !== missionResultDigest ||
    envelope.seededMissionEvaluationResultDigest !== missionResultDigest
  ) {
    addFinding(
      findings,
      "mission_evaluation_result_mismatch",
      "The expected or enveloped mission-evaluation result digest does not match deterministic recomputation.",
      "Refresh the exact admitted mission-evaluation result before constructing parity.",
    );
  }
  if (!missionResult.passed) {
    addFinding(
      findings,
      "mission_evaluation_not_admitted",
      "The governing Commons-seeded mission evaluation is not admitted.",
      "Resolve campaign custody and coverage before vendor parity.",
    );
  }
  if (parityRequest.garpaMissionState !== missionResult.missionState) {
    addFinding(
      findings,
      "mission_evaluation_state_mismatch",
      "The ordinary parity request changes the admitted target mission state.",
      "Use the exact mission state returned by the custodied evaluator.",
    );
  }
  if (parityRequestDigest !== envelope.vendorParityRequestDigest) {
    addFinding(
      findings,
      "vendor_parity_request_digest_mismatch",
      "The ordinary vendor-parity request differs from the digest-bound envelope.",
      "Restore the frozen parity request and recompute its canonical digest.",
    );
  }
  if (envelope.envelopeDigest !== envelopeDigest) {
    addFinding(
      findings,
      "parity_envelope_digest_mismatch",
      "The parity-envelope digest does not match its canonical content.",
      "Restore the immutable parity envelope and recompute its digest.",
    );
  }
  if (
    parityRequest.caseId !== envelope.caseId ||
    parityRequest.caseId !== asBuilt.caseId
  ) {
    addFinding(
      findings,
      "parity_case_mismatch",
      "The parity request, envelope, and as-built system do not identify the same target case.",
      "Evaluate the exact admitted target case.",
    );
  }
  if (
    envelope.missionOutcomeDigest !== qualification.missionOutcomeDigest ||
    envelope.qualificationContractDigest !== asBuilt.qualificationContractDigest ||
    envelope.asBuiltReceiptDigest !== asBuilt.receiptDigest ||
    envelope.campaignPreflightReceiptDigest !==
      missionResult.campaignPreflightReceiptDigest ||
    envelope.runSetDigest !== missionResult.runSetDigest ||
    envelope.seededMissionEvaluationEnvelopeDigest !==
      missionResult.evaluationEnvelopeDigest ||
    envelope.custodiedMissionEvaluationResultDigest !==
      missionResult.custodiedMissionEvaluationResultDigest ||
    parityRequest.garpaBuildReceiptDigest !== asBuilt.receiptDigest ||
    parityRequest.garpaQualificationContractDigest !==
      asBuilt.qualificationContractDigest
  ) {
    addFinding(
      findings,
      "parity_upstream_digest_mismatch",
      "Vendor parity is not bound to the exact mission outcome, qualification, as-built receipt, campaign preflight, run set, and mission evaluation.",
      "Rebuild parity from the exact admitted target chain.",
    );
  }
  if (
    Date.parse(envelope.evaluatedAt) <
      Date.parse(request.seededMissionEvaluationRequest.admittedAt) ||
    Date.parse(request.admittedAt) < Date.parse(envelope.evaluatedAt)
  ) {
    addFinding(
      findings,
      "parity_time_order_invalid",
      "Vendor parity predates mission-evaluation admission or is admitted before comparison completes.",
      "Restore chronology across mission evaluation, parity evaluation, and admission.",
    );
  }

  const metricIds = qualification.metrics.map((metric) => metric.id);
  const essentialMetricIds = qualification.metrics
    .filter((metric) => metric.criticality === "essential")
    .map((metric) => metric.id);
  const comparatorByMetric = new Map(
    parityRequest.comparators.map((comparator) => [
      comparator.metricId,
      comparator,
    ]),
  );
  if (
    !exactSet(metricIds, parityRequest.requiredMetricIds) ||
    !exactSet(essentialMetricIds, parityRequest.essentialMetricIds) ||
    qualification.metrics.some(
      (metric) => !comparatorMatches(metric, comparatorByMetric.get(metric.id)),
    )
  ) {
    addFinding(
      findings,
      "parity_metric_contract_mismatch",
      "The parity request omits, adds, or changes a frozen qualification metric, essentiality, direction, or unit.",
      "Compare every frozen qualification metric under a compatible parity comparator.",
    );
  }

  for (const issue of derivation.issues) {
    addFinding(
      findings,
      "garpa_observation_aggregation_unsupported",
      issue.reason,
      "Preserve the frozen aggregation or introduce a separately qualified parity derivation that can represent it exactly.",
      { metricId: issue.metricId, scenarioId: issue.scenarioId },
    );
  }
  if (
    derivedGarpaDigest !== requestedGarpaDigest ||
    envelope.garpaObservationSetDigest !== derivedGarpaDigest
  ) {
    addFinding(
      findings,
      "garpa_observation_set_mismatch",
      "The ordinary parity request does not contain the exact GARPA observations derived from the complete admitted campaign.",
      "Replace caller-selected GARPA observations with deterministic campaign aggregates.",
    );
  }
  if (envelope.vendorObservationSetDigest !== vendorObservationDigest) {
    addFinding(
      findings,
      "vendor_observation_set_mismatch",
      "The vendor observation ledger differs from the digest-bound envelope.",
      "Restore the complete exact-version vendor observation set.",
    );
  }
  if (
    envelope.vendorOffering !== parityRequest.vendorOffering ||
    (envelope.vendorVersion ?? "") !== (parityRequest.vendorVersion ?? "")
  ) {
    addFinding(
      findings,
      "vendor_identity_mismatch",
      "The parity envelope changes the evaluated vendor offering or version.",
      "Bind the exact vendor identity and version into both the request and envelope.",
    );
  }

  const artifactsById = new Map(
    envelope.vendorArtifacts.map((artifact) => [artifact.artifactId, artifact]),
  );
  const referencedVendorArtifactIds = sorted(
    vendorObservations.flatMap((observation) => observation.evidenceArtifactIds),
  );
  for (const artifactId of referencedVendorArtifactIds) {
    if (!artifactsById.has(artifactId)) {
      addFinding(
        findings,
        "vendor_artifact_custody_missing",
        `Vendor observation evidence ${artifactId} has no content-addressed envelope record.`,
        "Add an immutable SHA-256 artifact record for every vendor evidence reference.",
        { artifactId },
      );
    }
  }
  for (const artifact of envelope.vendorArtifacts) {
    if (!referencedVendorArtifactIds.includes(artifact.artifactId)) {
      addFinding(
        findings,
        "vendor_artifact_unexpected",
        `Vendor artifact ${artifact.artifactId} is not referenced by a submitted vendor observation.`,
        "Remove the ungoverned artifact or bind it to the exact observation it supports.",
        { artifactId: artifact.artifactId },
      );
    }
    if (Date.parse(artifact.capturedAt) > Date.parse(envelope.evaluatedAt)) {
      addFinding(
        findings,
        "vendor_artifact_time_order_invalid",
        `Vendor artifact ${artifact.artifactId} was captured after parity evaluation.`,
        "Capture and digest vendor evidence before evaluation.",
        { artifactId: artifact.artifactId },
      );
    }
  }
  if (envelope.qualificationTransferred !== false) {
    addFinding(
      findings,
      "qualification_transfer_attempted",
      "The parity envelope attempts to transfer source or vendor qualification.",
      "Keep qualification transfer structurally false.",
    );
  }
  if (envelope.unrestrictedEquivalenceClaimed !== false) {
    addFinding(
      findings,
      "unrestricted_equivalence_attempted",
      "The parity envelope attempts to claim unrestricted product equivalence.",
      "Report only the bounded state returned by the existing parity evaluator.",
    );
  }
  if (envelope.deploymentAuthorityClaimed !== false) {
    addFinding(
      findings,
      "deployment_authority_attempted",
      "The parity envelope attempts to authorize deployment.",
      "Keep deployment authority under the existing safety and release gates.",
    );
  }
  if (envelope.publicationAuthorityClaimed !== false) {
    addFinding(
      findings,
      "publication_authority_attempted",
      "The parity envelope attempts to authorize publication.",
      "Keep publication authority under the existing publication gate.",
    );
  }

  const blockingStates = new Set<CommonsSeededVendorParityFinding["state"]>([
    "vendor_parity_validation_failed",
    "mission_evaluation_result_mismatch",
    "mission_evaluation_not_admitted",
    "mission_evaluation_state_mismatch",
    "vendor_parity_request_digest_mismatch",
    "parity_envelope_digest_mismatch",
    "parity_case_mismatch",
    "parity_upstream_digest_mismatch",
    "parity_time_order_invalid",
    "parity_metric_contract_mismatch",
    "garpa_observation_set_mismatch",
    "vendor_observation_set_mismatch",
    "vendor_identity_mismatch",
    "vendor_artifact_custody_missing",
    "vendor_artifact_unexpected",
    "vendor_artifact_time_order_invalid",
    "ordinary_vendor_parity_failed",
    "ordinary_vendor_parity_state_missing",
    "qualification_transfer_attempted",
    "unrestricted_equivalence_attempted",
    "deployment_authority_attempted",
    "publication_authority_attempted",
  ]);

  let parityEvaluation:
    | ReturnType<typeof runVendorParityEvaluation>
    | undefined;
  let parityEvaluationDigest = "";
  if (!findings.some((finding) => blockingStates.has(finding.state))) {
    try {
      parityEvaluation = runVendorParityEvaluation(parityRequest);
      parityEvaluationDigest = sha256Hex(canonicalStringify(parityEvaluation));
      if (!parityEvaluation.state) {
        addFinding(
          findings,
          "ordinary_vendor_parity_state_missing",
          "The existing vendor-parity evaluator returned no recognized state.",
          "Repair the ordinary parity request without weakening custody.",
        );
      }
    } catch (error) {
      addFinding(
        findings,
        "ordinary_vendor_parity_failed",
        `The existing vendor-parity evaluator failed: ${String(error)}.`,
        "Repair the ordinary parity request without replacing the authoritative evaluator.",
      );
    }
  }

  const state =
    findings.length === 0
      ? "seeded_vendor_parity_admitted"
      : findings.some((finding) => blockingStates.has(finding.state))
        ? "seeded_vendor_parity_blocked"
        : "seeded_vendor_parity_incomplete";

  return {
    passed: state === "seeded_vendor_parity_admitted",
    state,
    parityState: parityEvaluation?.state,
    seededMissionEvaluationResult: missionResult,
    seededMissionEvaluationResultDigest: missionResultDigest,
    vendorParityRequestDigest: parityRequestDigest,
    parityEnvelopeDigest: envelopeDigest,
    garpaObservationSetDigest: derivedGarpaDigest,
    vendorObservationSetDigest: vendorObservationDigest,
    vendorParityEvaluation: parityEvaluation,
    vendorParityEvaluationDigest: parityEvaluationDigest,
    derivedGarpaObservations: derivation.observations,
    vendorObservations,
    vendorArtifactIds: envelope.vendorArtifacts.map(
      (artifact) => artifact.artifactId,
    ),
    findings,
    validationErrors: [],
    pullList: dedupe(findings.map((finding) => finding.requiredAction)),
    prohibitedTransitions: [...COMMONS_SEEDED_VENDOR_PARITY_PROHIBITED_TRANSITIONS],
  };
}
