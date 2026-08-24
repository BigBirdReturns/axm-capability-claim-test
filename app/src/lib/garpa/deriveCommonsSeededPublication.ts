import type {
  CaseDisposition,
  PublicationClaim,
  PublicationCompilationInput,
} from "../../types/garpaPublication";
import type {
  CommonsSeededPublicationArtifactRef,
} from "../../types/garpaCommonsSeededPublication";
import type {
  CommonsSeededVendorParityRequest,
  CommonsSeededVendorParityResult,
} from "../../types/garpaCommonsSeededVendorParity";
import { compilePublicationClaims } from "./compilePublicationClaims";
import { computeCommonsSeededPublicationCaseIndexDigest } from "./commonsSeededPublicationDigest";

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function nested(request: CommonsSeededVendorParityRequest) {
  const missionRequest = request.seededMissionEvaluationRequest;
  const firstRun = missionRequest.testRunRequests[0]!;
  const qualification = firstRun.seededPreflightRequest
    .seededBuildReceiptRequest.seededBuildManifestRequest
    .seededQualificationRequest.qualificationContract;
  const asBuilt = firstRun.seededPreflightRequest
    .seededBuildReceiptRequest.asBuiltReceipt;
  return { missionRequest, qualification, asBuilt };
}

function hasPositiveSupport(claim: PublicationClaim): boolean {
  return claim.supportRefs.some((support) =>
    [
      "direct_source",
      "derived_from",
      "measured_by",
      "evaluated_by",
      "costed_by",
    ].includes(support.relation),
  );
}

export function deriveCommonsSeededPublicationUpstreamDigests(
  request: CommonsSeededVendorParityRequest,
  result: CommonsSeededVendorParityResult,
): Record<string, string> {
  const { qualification, asBuilt } = nested(request);
  const mission = result.seededMissionEvaluationResult!;
  return {
    missionOutcome: qualification.missionOutcomeDigest,
    qualification: asBuilt.qualificationContractDigest,
    build: asBuilt.receiptDigest,
    campaignPreflight: mission.campaignPreflightReceiptDigest,
    runSet: mission.runSetDigest,
    missionEvaluation: mission.custodiedMissionEvaluationResultDigest,
    commonsMissionEvaluation: result.seededMissionEvaluationResultDigest,
    vendorParity: result.vendorParityEvaluationDigest,
    commonsVendorParity: result.parityEnvelopeDigest,
  };
}

export function deriveCommonsSeededPublicationCaseIndexDigest(
  request: CommonsSeededVendorParityRequest,
  result: CommonsSeededVendorParityResult,
): string {
  const { asBuilt } = nested(request);
  return computeCommonsSeededPublicationCaseIndexDigest(
    asBuilt.caseId,
    deriveCommonsSeededPublicationUpstreamDigests(request, result),
  );
}

export function deriveCommonsSeededPublicationDisposition(
  result: CommonsSeededVendorParityResult,
): CaseDisposition {
  const missionState = result.seededMissionEvaluationResult?.missionState;
  const parityState = result.parityState;
  if (missionState === "failed" || parityState === "same_fixture_miss") {
    return "develop";
  }
  if (
    ["matched", "bounded_match"].includes(missionState ?? "") &&
    parityState === "same_fixture_match"
  ) {
    return "compose";
  }
  if (
    ["partial", "incomparable", "unassessed"].includes(missionState ?? "") ||
    [
      "evidence_only_comparison",
      "vendor_baseline_missing",
      "scenario_mismatch",
      "accounting_boundary_mismatch",
      "incomparable",
      "not_attempted",
    ].includes(parityState ?? "")
  ) {
    return "wait_for_evidence";
  }
  return "unresolved";
}

export function deriveCommonsSeededPublicationClaims(
  request: CommonsSeededVendorParityRequest,
  result: CommonsSeededVendorParityResult,
  subject: string,
): PublicationClaim[] {
  const { missionRequest, qualification, asBuilt } = nested(request);
  const mission = result.seededMissionEvaluationResult!;
  const evaluation = mission.custodiedMissionEvaluationResult!;
  const parity = result.vendorParityEvaluation;
  const missionResiduals = dedupe([
    ...evaluation.residuals,
    ...evaluation.failures,
    ...evaluation.incomparableDimensions,
  ]);
  const input: PublicationCompilationInput = {
    caseId: asBuilt.caseId,
    subject,
    missionEvaluationDigest:
      mission.custodiedMissionEvaluationResultDigest,
    missionEvaluationState: mission.missionState!,
    missionBuildDigest: asBuilt.receiptDigest,
    missionScenarioIds: qualification.scenarios.map((scenario) => scenario.id),
    missionMetricIds: qualification.metrics.map((metric) => metric.id),
    missionResiduals,
    missionRunReceiptIds: mission.delegatedRunIds,
    vendorParityDigest: result.vendorParityEvaluationDigest,
    vendorParityState: result.parityState,
    vendorOffering: request.vendorParityRequest.vendorOffering,
    vendorVersion: request.vendorParityRequest.vendorVersion,
    matchedParityMetricIds: parity?.matchedMetricIds ?? [],
    parityScopeBoundary: parity?.scopeBoundary,
  };
  const missionBoundary =
    mission.missionEvaluationScope?.boundaryDescription ??
    missionRequest.missionBoundary.boundaryDescription;
  return compilePublicationClaims(input)
    .map((claim): PublicationClaim => {
      const supportRefs = [...claim.supportRefs];
      if (!hasPositiveSupport(claim)) {
        const evaluationDigest = claim.supportRefs.find(
          (support) => support.evaluationDigest,
        )?.evaluationDigest;
        supportRefs.push({
          relation: "evaluated_by",
          evaluationDigest,
          note: "The admitted evaluation established this mandatory residual.",
        });
      }
      const parityClaim = claim.id.startsWith("pub-parity");
      return {
        ...claim,
        scope: {
          ...claim.scope,
          environment: parityClaim
            ? parity?.scopeBoundary
            : missionBoundary,
        },
        supportRefs,
        state: "supported",
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function deriveCommonsSeededPublicationArtifacts(
  request: CommonsSeededVendorParityRequest,
): CommonsSeededPublicationArtifactRef[] {
  return request.parityEnvelope.vendorArtifacts
    .map((artifact) => ({ ...artifact }))
    .sort((left, right) => left.artifactId.localeCompare(right.artifactId));
}

export function collectPublicationArtifactIds(
  claims: PublicationClaim[],
  artifactDecisionIds: string[],
  safetyArtifactIds: string[],
  redactionArtifactIds: string[],
): string[] {
  return dedupe([
    ...claims.flatMap((claim) =>
      claim.supportRefs.flatMap((support) => [
        ...(support.artifactId ? [support.artifactId] : []),
        ...(support.locator?.artifactId ? [support.locator.artifactId] : []),
      ]),
    ),
    ...artifactDecisionIds,
    ...safetyArtifactIds,
    ...redactionArtifactIds,
  ]).sort();
}
