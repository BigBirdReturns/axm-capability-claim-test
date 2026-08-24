import type {
  ParityMetricComparator,
  ParityMetricDirection,
  ParityMetricObservation,
  VendorParityRequest,
} from "../../app/src/types/garpaParity";
import type { QualificationMetric } from "../../app/src/types/garpaQualification";
import type { CommonsSeededVendorParityRequest } from "../../app/src/types/garpaCommonsSeededVendorParity";
import {
  computeCommonsSeededGarpaObservationSetDigest,
  computeCommonsSeededVendorObservationSetDigest,
  computeCommonsSeededVendorParityEnvelopeDigest,
  computeVendorParityRequestDigest,
} from "../../app/src/lib/garpa/commonsSeededVendorParityDigest";
import { computeCommonsSeededMissionEvaluationResultDigest } from "../../app/src/lib/garpa/commonsSeededMissionEvaluationDigest";
import { deriveCommonsSeededGarpaParityObservations } from "../../app/src/lib/garpa/deriveCommonsSeededGarpaParity";
import { runCommonsSeededMissionEvaluationGate } from "../../app/src/lib/garpa/runCommonsSeededMissionEvaluationGate";
import { sha256Hex } from "../../app/src/lib/garpa/sha256";
import { buildCommonsSeededMissionEvaluationRequest } from "./garpaCommonsSeededMissionEvaluationFixture";

function addMilliseconds(value: string, milliseconds: number): string {
  return new Date(Date.parse(value) + milliseconds).toISOString();
}

function directionFor(metric: QualificationMetric): ParityMetricDirection {
  if (metric.direction === "higher_is_better") return "higher_is_better";
  if (metric.direction === "lower_is_better") return "lower_is_better";
  if (metric.direction === "boolean") return "boolean_equal";
  if (metric.direction === "categorical") return "categorical_equal";
  return "absolute_delta";
}

function comparatorFor(metric: QualificationMetric): ParityMetricComparator {
  const direction = directionFor(metric);
  const numeric = [
    "higher_is_better",
    "lower_is_better",
    "absolute_delta",
  ].includes(direction);
  if (numeric && !metric.unit) {
    throw new Error(`Numeric parity metric ${metric.id} requires a unit.`);
  }
  return {
    metricId: metric.id,
    label: metric.name,
    essential: metric.criticality === "essential",
    direction,
    ...(numeric
      ? {
          requiredUnit: metric.unit,
          absoluteTolerance: 0,
          relativeTolerance: 0,
        }
      : {}),
  };
}

export function refreshCommonsSeededVendorParityEnvelope(
  request: CommonsSeededVendorParityRequest,
): void {
  const garpaObservations = request.vendorParityRequest.observations.filter(
    (observation) => observation.subject === "garpa",
  );
  const vendorObservations = request.vendorParityRequest.observations.filter(
    (observation) => observation.subject === "vendor",
  );
  request.parityEnvelope.vendorParityRequestDigest =
    computeVendorParityRequestDigest(request.vendorParityRequest);
  request.parityEnvelope.garpaObservationSetDigest =
    computeCommonsSeededGarpaObservationSetDigest(garpaObservations);
  request.parityEnvelope.vendorObservationSetDigest =
    computeCommonsSeededVendorObservationSetDigest(vendorObservations);
  request.parityEnvelope.envelopeDigest =
    computeCommonsSeededVendorParityEnvelopeDigest(request.parityEnvelope);
}

export function buildCommonsSeededVendorParityRequest(): CommonsSeededVendorParityRequest {
  const seededMissionEvaluationRequest =
    buildCommonsSeededMissionEvaluationRequest();
  const missionResult = runCommonsSeededMissionEvaluationGate(
    seededMissionEvaluationRequest,
  );
  if (!missionResult.passed || !missionResult.missionState) {
    throw new Error(JSON.stringify(missionResult));
  }
  const derivation = deriveCommonsSeededGarpaParityObservations(
    seededMissionEvaluationRequest,
    missionResult,
  );
  if (derivation.issues.length > 0) {
    throw new Error(JSON.stringify(derivation.issues));
  }
  const firstRun = seededMissionEvaluationRequest.testRunRequests[0]!;
  const qualification = firstRun.seededPreflightRequest
    .seededBuildReceiptRequest.seededBuildManifestRequest
    .seededQualificationRequest.qualificationContract;
  const asBuilt = firstRun.seededPreflightRequest
    .seededBuildReceiptRequest.asBuiltReceipt;
  const vendorOffering = "Synthetic Vendor Reference System";
  const vendorVersion = "reference-1.0.0";
  const vendorObservations: ParityMetricObservation[] =
    derivation.observations.map((garpa, index) => ({
      id: `vendor:${garpa.metricId}:${String(index + 1).padStart(3, "0")}`,
      subject: "vendor",
      subjectVersion: vendorVersion,
      metricId: garpa.metricId,
      scenarioId: `vendor:${garpa.scenarioId}`,
      fixtureDigest: garpa.fixtureDigest,
      methodDigest: garpa.methodDigest,
      value: garpa.value,
      unit: garpa.unit,
      evidenceControl: "independent",
      evidenceArtifactIds: [
        `artifact:vendor:${garpa.metricId}:${String(index + 1).padStart(3, "0")}`,
      ],
      limitations: [
        "Synthetic exact-version same-fixture baseline for deterministic regression only.",
      ],
    }));
  const scenarioComparisons = derivation.observations.map((garpa, index) => ({
    id: `scenario-comparison:${String(index + 1).padStart(3, "0")}`,
    garpaScenarioId: garpa.scenarioId,
    vendorScenarioId: `vendor:${garpa.scenarioId}`,
    state: "same_fixture" as const,
    reasons: [
      "The exact vendor-version observation uses the same fixture and measurement-method digests as the deterministic GARPA campaign aggregate.",
    ],
  }));
  const vendorParityRequest: VendorParityRequest = {
    schemaVersion: 1,
    caseId: asBuilt.caseId,
    vendorOffering,
    vendorVersion,
    garpaMissionState: missionResult.missionState,
    garpaBuildReceiptDigest: asBuilt.receiptDigest,
    garpaQualificationContractDigest: asBuilt.qualificationContractDigest,
    requiredMetricIds: qualification.metrics.map((metric) => metric.id),
    essentialMetricIds: qualification.metrics
      .filter((metric) => metric.criticality === "essential")
      .map((metric) => metric.id),
    comparators: qualification.metrics.map(comparatorFor),
    observations: [...derivation.observations, ...vendorObservations],
    scenarioComparisons,
    accountingBoundaries: [],
  };
  const evaluatedAt = addMilliseconds(
    seededMissionEvaluationRequest.admittedAt,
    60_000,
  );
  const vendorArtifacts = vendorObservations.flatMap((observation) =>
    observation.evidenceArtifactIds.map((artifactId) => ({
      artifactId,
      sha256: sha256Hex(`bytes:${artifactId}`),
      mediaType: "application/json",
      path: `vendor/${vendorVersion}/${artifactId.replace(/[^a-z0-9]+/gi, "-")}.json`,
      capturedAt: addMilliseconds(
        seededMissionEvaluationRequest.admittedAt,
        30_000,
      ),
    })),
  );
  const missionResultDigest =
    computeCommonsSeededMissionEvaluationResultDigest(missionResult);
  const request: CommonsSeededVendorParityRequest = {
    schemaVersion: 1,
    seededMissionEvaluationRequest,
    expectedSeededMissionEvaluationResultDigest: missionResultDigest,
    vendorParityRequest,
    parityEnvelope: {
      schemaVersion: 1,
      parityId: "vendor-parity:GARPA-COMMONS-TARGET-0001:reference-1.0.0:v1",
      caseId: asBuilt.caseId,
      missionOutcomeDigest: qualification.missionOutcomeDigest,
      qualificationContractDigest: asBuilt.qualificationContractDigest,
      asBuiltReceiptDigest: asBuilt.receiptDigest,
      campaignPreflightReceiptDigest:
        missionResult.campaignPreflightReceiptDigest,
      runSetDigest: missionResult.runSetDigest,
      seededMissionEvaluationResultDigest: missionResultDigest,
      seededMissionEvaluationEnvelopeDigest:
        missionResult.evaluationEnvelopeDigest,
      custodiedMissionEvaluationResultDigest:
        missionResult.custodiedMissionEvaluationResultDigest,
      vendorParityRequestDigest:
        computeVendorParityRequestDigest(vendorParityRequest),
      garpaObservationSetDigest:
        computeCommonsSeededGarpaObservationSetDigest(derivation.observations),
      vendorObservationSetDigest:
        computeCommonsSeededVendorObservationSetDigest(vendorObservations),
      vendorOffering,
      vendorVersion,
      vendorArtifacts,
      evaluatedAt,
      qualificationTransferred: false,
      unrestrictedEquivalenceClaimed: false,
      deploymentAuthorityClaimed: false,
      publicationAuthorityClaimed: false,
      envelopeDigest: "0".repeat(64),
    },
    admittedAt: addMilliseconds(evaluatedAt, 60_000),
  };
  refreshCommonsSeededVendorParityEnvelope(request);
  return request;
}

export const buildSeededVendorParityRequest =
  buildCommonsSeededVendorParityRequest;
