import type {
  CommonsSeededMissionEvaluationFinding,
  CommonsSeededMissionEvaluationRequest,
  CommonsSeededMissionEvaluationResult,
  CommonsSeededRunDisposition,
} from "../../types/garpaCommonsSeededMissionEvaluation";
import {
  computeCommonsSeededMissionEvaluationEnvelopeDigest,
  computeCommonsSeededMissionRunSetDigest,
} from "./commonsSeededMissionEvaluationDigest";
import {
  buildMissionEvaluationScope,
  evaluateMetricCoverage,
  evaluateScenarioCoverage,
} from "./commonsSeededMissionEvaluationCoverage";
import {
  COMMONS_SEEDED_MISSION_EVALUATION_BLOCKING_STATES,
  COMMONS_SEEDED_MISSION_EVALUATION_PROHIBITED_TRANSITIONS,
  type RunEntry,
  addFinding,
  asBuiltOf,
  canonicalDigest,
  dedupe,
  missionOutcomeOf,
  ordinaryPreflightFor,
  preflightReceiptOf,
  qualificationOf,
  retainedRun,
  runEntry,
  sorted,
} from "./commonsSeededMissionEvaluationGateSupport";
import { evaluateMissionAdequacyWithCustody } from "./evaluateMissionAdequacyWithCustody";
import { runCommonsSeededTestRunGate } from "./runCommonsSeededTestRunGate";
import { validateCommonsSeededMissionEvaluationRequest } from "./validateCommonsSeededMissionEvaluation";

function emptyResult(
  findings: CommonsSeededMissionEvaluationFinding[],
  validationErrors: string[],
): CommonsSeededMissionEvaluationResult {
  return {
    passed: false,
    state: "seeded_mission_evaluation_blocked",
    custodiedMissionEvaluationResultDigest: "",
    evaluationEnvelopeDigest: "",
    campaignPreflightReceiptDigest: "",
    runSetDigest: "",
    admittedTestRunResultDigests: [],
    submittedRunIds: [],
    retainedRunIds: [],
    delegatedRunIds: [],
    excludedRunIds: [],
    validRunIds: [],
    failedMetricIds: [],
    abortedRunIds: [],
    invalidatedRunIds: [],
    incompleteRunIds: [],
    scenarioCoverage: [],
    metricCoverage: [],
    runDispositions: [],
    findings,
    validationErrors,
    testRunResults: [],
    testRunReceipts: [],
    ordinaryPreflightReceipts: [],
    pullList: dedupe(findings.map((finding) => finding.requiredAction)),
    prohibitedTransitions: [
      ...COMMONS_SEEDED_MISSION_EVALUATION_PROHIBITED_TRANSITIONS,
    ],
  };
}

function sameSet(left: string[], right: string[]): boolean {
  const a = sorted(left);
  const b = sorted(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function bindRun(
  request: CommonsSeededMissionEvaluationRequest,
  entry: RunEntry,
  findings: CommonsSeededMissionEvaluationFinding[],
): void {
  const binding = request.evaluationEnvelope.runBindings.find(
    (candidate) => candidate.runId === entry.receipt.runId,
  );
  if (!binding) {
    addFinding(
      findings,
      "run_binding_missing",
      `Retained run ${entry.receipt.runId} has no evaluation-envelope binding.`,
      "Bind every submitted run result, receipt, reservation, preflight, as-built receipt, and qualification digest.",
      { runId: entry.receipt.runId, scenarioId: entry.receipt.scenarioId },
    );
    return;
  }
  const reservation = preflightReceiptOf(entry.request).runReservations.find(
    (candidate) => candidate.runId === entry.receipt.runId,
  );
  if (binding.expectedTestRunResultDigest !== entry.resultDigest) {
    addFinding(
      findings,
      "test_run_result_mismatch",
      `Run ${entry.receipt.runId} differs from its frozen deterministic test-run result digest.`,
      "Recompute the exact test-run gate result and rebuild the campaign envelope.",
      { runId: entry.receipt.runId, scenarioId: entry.receipt.scenarioId },
    );
  }
  if (
    !reservation ||
    binding.scenarioId !== entry.receipt.scenarioId ||
    binding.reservationReceiptId !== reservation.reservationReceiptId ||
    binding.expectedTestRunReceiptDigest !== entry.receipt.resultDigest ||
    binding.expectedSeededPreflightResultDigest !==
      entry.result.seededPreflightResultDigest ||
    binding.expectedPreflightReceiptDigest !== entry.result.preflightReceiptDigest ||
    binding.expectedAsBuiltReceiptDigest !== asBuiltOf(entry.request).receiptDigest ||
    binding.expectedQualificationContractDigest !==
      entry.receipt.qualificationContractDigest
  ) {
    addFinding(
      findings,
      "run_binding_mismatch",
      `Run ${entry.receipt.runId} differs from its frozen receipt, scenario, reservation, preflight, as-built, or qualification binding.`,
      "Restore the exact immutable run chain and rebuild the evaluation envelope.",
      { runId: entry.receipt.runId, scenarioId: entry.receipt.scenarioId },
    );
  }
}

function verifySharedCampaign(
  request: CommonsSeededMissionEvaluationRequest,
  entries: RunEntry[],
  findings: CommonsSeededMissionEvaluationFinding[],
): void {
  const first = entries[0];
  if (!first) return;
  const firstQualification = qualificationOf(first.request);
  const firstAsBuilt = asBuiltOf(first.request);
  const firstPreflight = preflightReceiptOf(first.request);
  const firstMission = missionOutcomeOf(first.request);
  const envelope = request.evaluationEnvelope;

  if (
    envelope.caseId !== first.receipt.caseId ||
    envelope.caseId !== firstQualification.caseId
  ) {
    addFinding(
      findings,
      "evaluation_case_mismatch",
      "The campaign envelope is not bound to the exact target case.",
      "Rebuild the campaign from one exact target case.",
    );
  }
  if (
    envelope.missionOutcomeDigest !== firstQualification.missionOutcomeDigest ||
    envelope.qualificationContractDigest !==
      firstAsBuilt.qualificationContractDigest ||
    envelope.asBuiltReceiptDigest !== firstAsBuilt.receiptDigest ||
    envelope.campaignPreflightReceiptDigest !== firstPreflight.receiptDigest
  ) {
    addFinding(
      findings,
      "evaluation_upstream_digest_mismatch",
      "The campaign envelope is not bound to the exact mission, qualification, as-built, and preflight chain.",
      "Rebuild the envelope from the admitted target execution chain.",
    );
  }

  for (const entry of entries.slice(1)) {
    const currentQualification = qualificationOf(entry.request);
    const currentAsBuilt = asBuiltOf(entry.request);
    const currentPreflight = preflightReceiptOf(entry.request);
    const currentMission = missionOutcomeOf(entry.request);
    if (
      entry.receipt.caseId !== first.receipt.caseId ||
      currentQualification.missionOutcomeDigest !==
        firstQualification.missionOutcomeDigest ||
      currentAsBuilt.receiptDigest !== firstAsBuilt.receiptDigest ||
      currentPreflight.receiptDigest !== firstPreflight.receiptDigest ||
      canonicalDigest(currentQualification) !== canonicalDigest(firstQualification) ||
      canonicalDigest(currentMission) !== canonicalDigest(firstMission)
    ) {
      addFinding(
        findings,
        "campaign_preflight_mismatch",
        `Run ${entry.receipt.runId} belongs to a different target campaign chain or preflight receipt.`,
        "Evaluate only the executions reserved by the exact shared campaign preflight receipt.",
        { runId: entry.receipt.runId, scenarioId: entry.receipt.scenarioId },
      );
    }
  }
}

function verifyCompleteReservationLedger(
  entries: RunEntry[],
  findings: CommonsSeededMissionEvaluationFinding[],
): void {
  const first = entries[0];
  if (!first) return;
  const reservedRunIds = preflightReceiptOf(first.request).runReservations.map(
    (reservation) => reservation.runId,
  );
  const submittedRunIds = entries.map((entry) => entry.receipt.runId);
  for (const runId of reservedRunIds) {
    if (!submittedRunIds.includes(runId)) {
      addFinding(
        findings,
        "reserved_run_omitted",
        `Reserved run ${runId} is absent from the submitted campaign ledger.`,
        "Submit and retain the exact reserved execution, including a failed, aborted, invalidated, or incomplete receipt.",
        { runId },
      );
    }
  }
  if (!sameSet(reservedRunIds, submittedRunIds)) {
    addFinding(
      findings,
      "run_set_incomplete",
      "The submitted run set is not the complete reservation ledger from the governing campaign preflight receipt.",
      "Submit every reserved run exactly once and remove every unreserved execution.",
    );
  }
}

function buildDispositions(
  entries: RunEntry[],
  retainedEntries: RunEntry[],
  evaluatorExcludedRunIds: string[],
): CommonsSeededRunDisposition[] {
  const retained = new Set(retainedEntries.map((entry) => entry.receipt.runId));
  const evaluatorExcluded = new Set(evaluatorExcludedRunIds);
  return entries.map((entry) => {
    const exclusionReasons: string[] = [];
    if (!retained.has(entry.receipt.runId)) {
      exclusionReasons.push(...entry.result.findings.map((finding) => finding.reason));
    }
    if (entry.receipt.state !== "valid") {
      exclusionReasons.push(`Receipt state is ${entry.receipt.state}.`);
    }
    if (evaluatorExcluded.has(entry.receipt.runId)) {
      exclusionReasons.push(
        "The existing custodied evaluator excluded the run from substantive acceptance.",
      );
    }
    return {
      runId: entry.receipt.runId,
      scenarioId: entry.receipt.scenarioId,
      testRunGateState: entry.result.state,
      receiptState: entry.receipt.state,
      retained: retained.has(entry.receipt.runId),
      delegated: retained.has(entry.receipt.runId),
      excluded:
        !retained.has(entry.receipt.runId) ||
        evaluatorExcluded.has(entry.receipt.runId),
      exclusionReasons: dedupe(exclusionReasons),
    };
  });
}

export function runCommonsSeededMissionEvaluationGate(
  input: CommonsSeededMissionEvaluationRequest | unknown,
): CommonsSeededMissionEvaluationResult {
  const validated = validateCommonsSeededMissionEvaluationRequest(input);
  if (!validated.ok || !validated.value) {
    const findings = validated.errors.map((reason) => ({
      state: "mission_evaluation_validation_failed" as const,
      reason,
      requiredAction:
        "Repair the Commons-seeded mission-evaluation request and rerun validation.",
    }));
    return emptyResult(findings, validated.errors);
  }

  const request = validated.value;
  const findings: CommonsSeededMissionEvaluationFinding[] = [];
  const envelope = request.evaluationEnvelope;
  const evaluationEnvelopeDigest =
    computeCommonsSeededMissionEvaluationEnvelopeDigest(envelope);
  const runSetDigest = computeCommonsSeededMissionRunSetDigest(
    envelope.runBindings,
  );
  if (envelope.envelopeDigest !== evaluationEnvelopeDigest) {
    addFinding(
      findings,
      "evaluation_envelope_digest_mismatch",
      "The mission-evaluation envelope digest does not match its canonical content.",
      "Restore the immutable evaluation envelope and recompute its digest.",
    );
  }
  if (envelope.runSetDigest !== runSetDigest) {
    addFinding(
      findings,
      "run_set_digest_mismatch",
      "The campaign run-set digest does not match the canonical run bindings.",
      "Recompute the run-set digest from the complete sorted binding ledger.",
    );
  }
  if (envelope.qualificationTransferred !== false) {
    addFinding(
      findings,
      "qualification_transfer_attempted",
      "The evaluation envelope attempts to transfer source qualification.",
      "Keep qualification transfer structurally false and evaluate only target executions.",
    );
  }
  if (envelope.missionEquivalenceClaimed !== false) {
    addFinding(
      findings,
      "mission_equivalence_attempted",
      "The evaluation envelope attempts to claim unrestricted mission equivalence.",
      "Keep mission equivalence structurally false and preserve the bounded ordinary evaluator state.",
    );
  }

  const testRunResults = request.testRunRequests.map((runRequest) =>
    runCommonsSeededTestRunGate(runRequest),
  );
  const entries = testRunResults.flatMap((result, index) => {
    const entry = runEntry(request.testRunRequests[index]!, result);
    if (!entry) {
      addFinding(
        findings,
        "test_run_request_invalid",
        `Test-run request ${index} produced no preservable receipt.`,
        "Repair the test-run request and retain its exact execution receipt.",
      );
      return [];
    }
    return [entry];
  });

  const seenRunIds = new Set<string>();
  for (const entry of entries) {
    if (seenRunIds.has(entry.receipt.runId)) {
      addFinding(
        findings,
        "run_set_duplicate",
        `Run ${entry.receipt.runId} appears more than once in the campaign ledger.`,
        "Submit each immutable run receipt exactly once.",
        { runId: entry.receipt.runId, scenarioId: entry.receipt.scenarioId },
      );
    }
    seenRunIds.add(entry.receipt.runId);
    if (entry.result.state === "seeded_test_run_blocked") {
      addFinding(
        findings,
        "test_run_blocked",
        `Run ${entry.receipt.runId} is blocked as execution evidence.`,
        "Resolve the test-run custody contradiction before mission evaluation.",
        { runId: entry.receipt.runId, scenarioId: entry.receipt.scenarioId },
      );
    }
    bindRun(request, entry, findings);
  }
  for (const binding of envelope.runBindings) {
    if (!seenRunIds.has(binding.runId)) {
      addFinding(
        findings,
        "run_binding_unexpected",
        `Binding ${binding.runId} has no submitted test-run request.`,
        "Remove the stale binding or submit the exact governed execution.",
        { runId: binding.runId, scenarioId: binding.scenarioId },
      );
    }
  }

  verifySharedCampaign(request, entries, findings);
  verifyCompleteReservationLedger(entries, findings);

  if (entries.length > 0) {
    const latestRunEnd = Math.max(
      ...entries.map((entry) => Date.parse(entry.receipt.endedAt)),
    );
    if (
      Date.parse(envelope.evaluatedAt) < latestRunEnd ||
      Date.parse(request.admittedAt) < Date.parse(envelope.evaluatedAt)
    ) {
      addFinding(
        findings,
        "evaluation_time_order_invalid",
        "Mission evaluation predates a submitted run or is admitted before evaluation completes.",
        "Restore chronology across campaign completion, evaluation, and admission.",
      );
    }
  }

  const retainedEntries = entries.filter((entry) => retainedRun(entry.result));
  const first = retainedEntries[0] ?? entries[0];
  const missionEvaluationScope = first
    ? buildMissionEvaluationScope(first, request.missionBoundary, findings)
    : undefined;
  const scenarioCoverage = first
    ? evaluateScenarioCoverage(first, entries, findings)
    : [];
  const metricCoverage = first
    ? evaluateMetricCoverage(first, entries, findings)
    : [];

  const ordinaryPreflightReceipts = retainedEntries.flatMap((entry) => {
    const preflight = ordinaryPreflightFor(entry);
    if (preflight) return [preflight];
    addFinding(
      findings,
      "custodied_evaluation_failed",
      `Run ${entry.receipt.runId} cannot be adapted to an ordinary preflight receipt.`,
      "Restore the admitted Commons preflight result and ordinary preflight gate.",
      { runId: entry.receipt.runId, scenarioId: entry.receipt.scenarioId },
    );
    return [];
  });

  let custodiedMissionEvaluationResult:
    | CommonsSeededMissionEvaluationResult["custodiedMissionEvaluationResult"];
  let custodiedMissionEvaluationResultDigest = "";
  if (
    missionEvaluationScope &&
    !findings.some((finding) =>
      COMMONS_SEEDED_MISSION_EVALUATION_BLOCKING_STATES.has(finding.state),
    )
  ) {
    try {
      custodiedMissionEvaluationResult = evaluateMissionAdequacyWithCustody({
        scope: missionEvaluationScope,
        testRunReceipts: retainedEntries.map((entry) => entry.receipt),
        preflightReceipts: ordinaryPreflightReceipts,
      });
      custodiedMissionEvaluationResultDigest = canonicalDigest(
        custodiedMissionEvaluationResult,
      );
      if (!custodiedMissionEvaluationResult.state) {
        addFinding(
          findings,
          "custodied_evaluation_state_missing",
          "The existing custodied mission evaluator returned no mission-adequacy state.",
          "Repair the deterministic ordinary evaluation input without weakening campaign custody.",
        );
      }
      if (
        custodiedMissionEvaluationResult.caseId !==
          missionEvaluationScope.caseId ||
        custodiedMissionEvaluationResult.qualificationContractDigest !==
          missionEvaluationScope.qualificationContractDigest ||
        custodiedMissionEvaluationResult.evaluatedBuildDigest !==
          missionEvaluationScope.buildDigest
      ) {
        addFinding(
          findings,
          "evaluation_case_mismatch",
          "The existing custodied evaluator returned a result for a different case, qualification contract, or build.",
          "Repair the ordinary custody adapter and rerun the exact target campaign.",
        );
      }
    } catch (error) {
      addFinding(
        findings,
        "custodied_evaluation_failed",
        `The existing custodied mission evaluator failed: ${String(error)}.`,
        "Repair the deterministic ordinary evaluation input without weakening campaign custody.",
      );
    }
  }

  const evaluatorExcludedRunIds =
    custodiedMissionEvaluationResult?.excludedRunIds ?? [];
  const runDispositions = buildDispositions(
    entries,
    retainedEntries,
    evaluatorExcludedRunIds,
  );
  const failedMetricIds = sorted(
    retainedEntries.flatMap((entry) =>
      entry.receipt.metricResults
        .filter((metric) => metric.thresholdResult === "fail")
        .map((metric) => metric.metricId),
    ),
  );
  const state = findings.some((finding) =>
    COMMONS_SEEDED_MISSION_EVALUATION_BLOCKING_STATES.has(finding.state),
  )
    ? "seeded_mission_evaluation_blocked"
    : findings.length > 0
      ? "seeded_mission_evaluation_incomplete"
      : "seeded_mission_evaluation_admitted";

  return {
    passed: state === "seeded_mission_evaluation_admitted",
    state,
    missionState: custodiedMissionEvaluationResult?.state,
    missionEvaluationScope,
    custodiedMissionEvaluationResult,
    custodiedMissionEvaluationResultDigest,
    evaluationEnvelopeDigest,
    campaignPreflightReceiptDigest:
      first?.request.seededPreflightRequest.preflightReceipt.receiptDigest ?? "",
    runSetDigest,
    admittedTestRunResultDigests: retainedEntries.map(
      (entry) => entry.resultDigest,
    ),
    submittedRunIds: sorted(entries.map((entry) => entry.receipt.runId)),
    retainedRunIds: sorted(
      retainedEntries.map((entry) => entry.receipt.runId),
    ),
    delegatedRunIds: sorted(
      retainedEntries.map((entry) => entry.receipt.runId),
    ),
    excludedRunIds: sorted(
      runDispositions
        .filter((disposition) => disposition.excluded)
        .map((disposition) => disposition.runId),
    ),
    validRunIds: sorted(
      retainedEntries
        .filter((entry) => entry.receipt.state === "valid")
        .map((entry) => entry.receipt.runId),
    ),
    failedMetricIds,
    abortedRunIds: sorted(
      entries
        .filter((entry) => entry.receipt.state === "aborted")
        .map((entry) => entry.receipt.runId),
    ),
    invalidatedRunIds: sorted(
      entries
        .filter((entry) => entry.receipt.state === "invalidated")
        .map((entry) => entry.receipt.runId),
    ),
    incompleteRunIds: sorted(
      entries
        .filter(
          (entry) =>
            entry.receipt.state === "incomplete" ||
            entry.result.state === "seeded_test_run_incomplete",
        )
        .map((entry) => entry.receipt.runId),
    ),
    scenarioCoverage,
    metricCoverage,
    runDispositions,
    findings,
    validationErrors: [],
    testRunResults,
    testRunReceipts: entries.map((entry) => entry.receipt),
    ordinaryPreflightReceipts,
    pullList: dedupe(findings.map((finding) => finding.requiredAction)),
    prohibitedTransitions: [
      ...COMMONS_SEEDED_MISSION_EVALUATION_PROHIBITED_TRANSITIONS,
    ],
  };
}
