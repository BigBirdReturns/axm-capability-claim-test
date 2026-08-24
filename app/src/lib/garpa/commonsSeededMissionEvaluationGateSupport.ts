import type { MissionOutcome } from "../../types/garpa";
import type {
  CommonsSeededMissionEvaluationFinding,
  CommonsSeededMissionEvaluationFindingState,
} from "../../types/garpaCommonsSeededMissionEvaluation";
import type {
  CommonsSeededTestRunRequest,
  CommonsSeededTestRunResult,
} from "../../types/garpaCommonsSeededTestRun";
import type { TestRunReceipt } from "../../types/garpaExecution";
import type { PreflightReceipt } from "../../types/garpaPreflight";
import type { QualificationContract } from "../../types/garpaQualification";
import { canonicalStringify } from "./canonicalJson";
import { computeCommonsSeededTestRunResultDigest } from "./commonsSeededTestRunDigest";
import { sha256Hex } from "./sha256";

export const COMMONS_SEEDED_MISSION_EVALUATION_PROHIBITED_TRANSITIONS = [
  "Mission-evaluation admission does not establish vendor parity, deployment authority, or publication authority.",
  "Failed, aborted, invalidated, incomplete, and excluded executions remain part of the evaluation record and cannot be silently discarded.",
  "Target mission adequacy is bounded by the frozen qualification scenarios, metrics, fixtures, environment, and run custody; no source qualification or unrestricted equivalence transfers.",
] as const;

export const COMMONS_SEEDED_MISSION_EVALUATION_BLOCKING_STATES = new Set<
  CommonsSeededMissionEvaluationFindingState
>([
  "mission_evaluation_validation_failed",
  "test_run_request_invalid",
  "test_run_result_mismatch",
  "test_run_blocked",
  "run_binding_missing",
  "run_binding_unexpected",
  "run_binding_mismatch",
  "run_set_duplicate",
  "reserved_run_omitted",
  "campaign_preflight_mismatch",
  "evaluation_envelope_digest_mismatch",
  "run_set_digest_mismatch",
  "evaluation_case_mismatch",
  "evaluation_upstream_digest_mismatch",
  "evaluation_time_order_invalid",
  "mission_boundary_mismatch",
  "custodied_evaluation_failed",
  "custodied_evaluation_state_missing",
  "qualification_transfer_attempted",
  "mission_equivalence_attempted",
]);

export interface RunEntry {
  request: CommonsSeededTestRunRequest;
  result: CommonsSeededTestRunResult;
  receipt: TestRunReceipt;
  resultDigest: string;
}

export function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function sorted(values: string[]): string[] {
  return dedupe(values).sort((left, right) => left.localeCompare(right));
}

export function addFinding(
  findings: CommonsSeededMissionEvaluationFinding[],
  state: CommonsSeededMissionEvaluationFindingState,
  reason: string,
  requiredAction: string,
  coordinates: Partial<CommonsSeededMissionEvaluationFinding> = {},
): void {
  findings.push({ state, reason, requiredAction, ...coordinates });
}

export function canonicalDigest(value: unknown): string {
  return sha256Hex(canonicalStringify(value));
}

export function qualificationOf(
  request: CommonsSeededTestRunRequest,
): QualificationContract {
  return request.seededPreflightRequest.seededBuildReceiptRequest
    .seededBuildManifestRequest.seededQualificationRequest.qualificationContract;
}

export function missionOutcomeOf(
  request: CommonsSeededTestRunRequest,
): MissionOutcome {
  return request.seededPreflightRequest.seededBuildReceiptRequest
    .seededBuildManifestRequest.seededQualificationRequest.targetMissionOutcome;
}

export function asBuiltOf(request: CommonsSeededTestRunRequest) {
  return request.seededPreflightRequest.seededBuildReceiptRequest.asBuiltReceipt;
}

export function preflightReceiptOf(request: CommonsSeededTestRunRequest) {
  return request.seededPreflightRequest.preflightReceipt;
}

export function retainedRun(result: CommonsSeededTestRunResult): boolean {
  return Boolean(result.testRunReceipt) && result.state !== "seeded_test_run_blocked";
}

export function runEntry(
  request: CommonsSeededTestRunRequest,
  result: CommonsSeededTestRunResult,
): RunEntry | undefined {
  if (!result.testRunReceipt) return undefined;
  return {
    request,
    result,
    receipt: result.testRunReceipt,
    resultDigest: computeCommonsSeededTestRunResultDigest(result),
  };
}

export function ordinaryPreflightFor(
  entry: RunEntry,
): PreflightReceipt | undefined {
  const seededPreflight = entry.result.seededPreflightResult;
  const preflight = seededPreflight?.preflightReceipt;
  const gate = seededPreflight?.ordinaryPreflightGate;
  if (!preflight || !gate) return undefined;
  const asBuilt = asBuiltOf(entry.request);
  return {
    schemaVersion: 1,
    caseId: preflight.caseId,
    runId: entry.receipt.runId,
    buildId: asBuilt.receiptId,
    buildDigest: entry.receipt.buildDigest,
    manifestDigest: preflight.buildManifestDigest,
    qualificationContractDigest: preflight.qualificationContractDigest,
    readiness: gate.readiness,
    gate,
    evaluatedAt: preflight.preflightAt,
    preflightDigest: preflight.receiptDigest,
  };
}
