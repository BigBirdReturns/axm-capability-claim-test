import type { TestRunReceipt } from "../../types/garpaExecution";
import type {
  CommonsSeededMissionEvaluationFinding,
  CommonsSeededMissionEvaluationRequest,
  CommonsSeededMissionEvaluationResult,
  CommonsSeededMissionState,
} from "../../types/garpaCommonsSeededMissionEvaluation";
import type { CommonsSeededTestRunResult } from "../../types/garpaCommonsSeededTestRun";
import { canonicalStringify } from "./canonicalJson";
import { computeCommonsSeededMissionEvaluationEnvelopeDigest } from "./commonsSeededMissionEvaluationDigest";
import { runCommonsSeededTestRunGate } from "./runCommonsSeededTestRunGate";
import { runCustodiedMissionEvaluation } from "./runCustodiedMissionEvaluation";
import { sha256Hex } from "./sha256";
import { validateCommonsSeededMissionEvaluationRequest } from "./validateCommonsSeededMissionEvaluation";

export const COMMONS_SEEDED_MISSION_EVALUATION_PROHIBITED_TRANSITIONS = [
  "Mission-evaluation admission does not establish vendor parity, deployment authority, or publication authority.",
  "Failed, aborted, invalidated, incomplete, and excluded executions remain part of the evaluation record and cannot be silently discarded.",
  "Target mission adequacy is bounded by the frozen qualification scenarios, metrics, fixtures, environment, and run custody; no source qualification or unrestricted equivalence transfers.",
] as const;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function addFinding(
  findings: CommonsSeededMissionEvaluationFinding[],
  state: CommonsSeededMissionEvaluationFinding["state"],
  reason: string,
  requiredAction: string,
  coordinates: Partial<CommonsSeededMissionEvaluationFinding> = {},
): void {
  findings.push({ state, reason, requiredAction, ...coordinates });
}

function isTestRunReceipt(value: unknown): value is TestRunReceipt {
  return (
    isRecord(value) &&
    typeof value.runId === "string" &&
    typeof value.scenarioId === "string" &&
    typeof value.resultDigest === "string" &&
    Array.isArray(value.metricResults) &&
    typeof value.state === "string"
  );
}

function collectTestRunReceipts(root: unknown): TestRunReceipt[] {
  const found: TestRunReceipt[] = [];
  const seen = new Set<unknown>();
  function walk(value: unknown): void {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (isTestRunReceipt(value)) {
      found.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    Object.values(value as RecordValue).forEach(walk);
  }
  walk(root);
  return found;
}

function missionStateOf(root: unknown): CommonsSeededMissionState | undefined {
  const states = new Set<CommonsSeededMissionState>([
    "matched",
    "bounded_match",
    "partial",
    "failed",
    "incomparable",
    "unassessed",
  ]);
  const seen = new Set<unknown>();
  function walk(value: unknown): CommonsSeededMissionState | undefined {
    if (!value || typeof value !== "object" || seen.has(value)) return undefined;
    seen.add(value);
    if (
      isRecord(value) &&
      typeof value.state === "string" &&
      states.has(value.state as CommonsSeededMissionState)
    ) {
      return value.state as CommonsSeededMissionState;
    }
    for (const child of Array.isArray(value)
      ? value
      : Object.values(value as RecordValue)) {
      const state = walk(child);
      if (state) return state;
    }
    return undefined;
  }
  return walk(root);
}

function canonicalDigest(value: unknown): string {
  return sha256Hex(canonicalStringify(value));
}

function resultEnvelopeDigests(
  result: CommonsSeededTestRunResult,
  request: CommonsSeededMissionEvaluationRequest["testRunRequests"][number],
): {
  caseId: string;
  qualificationContractDigest: string;
  asBuiltReceiptDigest: string;
  preflightReceiptDigest: string;
} {
  const receipt = result.testRunReceipt!;
  const envelope = request.executionEnvelope as unknown as RecordValue;
  return {
    caseId: receipt.caseId,
    qualificationContractDigest: receipt.qualificationContractDigest,
    asBuiltReceiptDigest: String(envelope.asBuiltReceiptDigest ?? ""),
    preflightReceiptDigest: String(envelope.preflightReceiptDigest ?? ""),
  };
}

function requiredScenarioCounts(root: unknown): Map<string, number> {
  const seen = new Set<unknown>();
  let scenarios: RecordValue[] = [];
  let metrics: RecordValue[] = [];
  function walk(value: unknown): void {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (
      isRecord(value) &&
      Array.isArray(value.scenarios) &&
      Array.isArray(value.metrics) &&
      isRecord(value.acceptanceRule)
    ) {
      scenarios = value.scenarios.filter(isRecord);
      metrics = value.metrics.filter(isRecord);
      return;
    }
    for (const child of Array.isArray(value)
      ? value
      : Object.values(value as RecordValue)) {
      if (scenarios.length === 0) walk(child);
    }
  }
  walk(root);
  const counts = new Map<string, number>();
  for (const scenario of scenarios) {
    const id = String(scenario.id ?? "");
    if (!id) continue;
    const direct = Number(
      scenario.requiredRuns ?? scenario.minimumRuns ?? scenario.minRuns ?? 1,
    );
    counts.set(id, Number.isFinite(direct) && direct > 0 ? Math.floor(direct) : 1);
  }
  for (const metric of metrics) {
    const required = Number(
      metric.requiredRuns ?? metric.minimumRuns ?? metric.minRuns ?? 0,
    );
    if (!Number.isFinite(required) || required <= 0) continue;
    const scenarioIds = Array.isArray(metric.scenarioIds)
      ? metric.scenarioIds.filter(
          (item): item is string => typeof item === "string",
        )
      : [];
    for (const scenarioId of scenarioIds) {
      counts.set(
        scenarioId,
        Math.max(counts.get(scenarioId) ?? 1, Math.floor(required)),
      );
    }
  }
  return counts;
}

export function runCommonsSeededMissionEvaluationGate(
  input: CommonsSeededMissionEvaluationRequest | unknown,
): CommonsSeededMissionEvaluationResult {
  const validated = validateCommonsSeededMissionEvaluationRequest(input);
  if (!validated.ok || !validated.value) {
    return {
      passed: false,
      state: "seeded_mission_evaluation_blocked",
      custodiedMissionEvaluationResultDigest: "",
      evaluationEnvelopeDigest: "",
      admittedTestRunResultDigests: [],
      admittedRunIds: [],
      validRunIds: [],
      failedMetricIds: [],
      abortedRunIds: [],
      invalidatedRunIds: [],
      incompleteRunIds: [],
      findings: validated.errors.map((reason) => ({
        state: "mission_evaluation_validation_failed" as const,
        reason,
        requiredAction:
          "Repair the Commons-seeded mission-evaluation request and rerun validation.",
      })),
      validationErrors: validated.errors,
      testRunResults: [],
      testRunReceipts: [],
      pullList: validated.errors,
      prohibitedTransitions: [
        ...COMMONS_SEEDED_MISSION_EVALUATION_PROHIBITED_TRANSITIONS,
      ],
    };
  }

  const request = validated.value;
  const findings: CommonsSeededMissionEvaluationFinding[] = [];
  const envelope = request.evaluationEnvelope;
  const envelopeDigest =
    computeCommonsSeededMissionEvaluationEnvelopeDigest(envelope);
  const testRunResults = request.testRunRequests.map((runRequest) =>
    runCommonsSeededTestRunGate(runRequest),
  );
  const resultDigests = testRunResults.map(canonicalDigest);
  const receipts = testRunResults.flatMap((result) =>
    result.testRunReceipt ? [result.testRunReceipt] : [],
  );
  const bindings = new Map(
    envelope.runBindings.map((binding) => [binding.runId, binding]),
  );

  if (envelope.envelopeDigest !== envelopeDigest) {
    addFinding(
      findings,
      "evaluation_envelope_digest_mismatch",
      "The mission-evaluation envelope digest does not match its canonical content.",
      "Restore the immutable evaluation envelope and recompute its digest.",
    );
  }

  const seenRunIds = new Set<string>();
  testRunResults.forEach((result, index) => {
    const receipt = result.testRunReceipt;
    if (!result.passed || !receipt) {
      addFinding(
        findings,
        "test_run_not_admitted",
        `Test-run request ${index} is not admitted as execution evidence.`,
        "Resolve the test-run receipt findings before mission evaluation.",
      );
      return;
    }
    if (seenRunIds.has(receipt.runId)) {
      addFinding(
        findings,
        "run_set_duplicate",
        `Run ${receipt.runId} appears more than once in the submitted run set.`,
        "Submit each immutable run receipt exactly once.",
        { runId: receipt.runId, scenarioId: receipt.scenarioId },
      );
    }
    seenRunIds.add(receipt.runId);
    const binding = bindings.get(receipt.runId);
    if (!binding) {
      addFinding(
        findings,
        "run_binding_missing",
        `Admitted run ${receipt.runId} has no evaluation-envelope binding.`,
        "Bind every submitted run result and receipt digest into the evaluation envelope.",
        { runId: receipt.runId, scenarioId: receipt.scenarioId },
      );
      return;
    }
    if (
      binding.expectedTestRunResultDigest !== resultDigests[index] ||
      binding.expectedTestRunReceiptDigest !== receipt.resultDigest ||
      binding.scenarioId !== receipt.scenarioId
    ) {
      addFinding(
        findings,
        "run_binding_mismatch",
        `Run ${receipt.runId} differs from its frozen result, receipt, or scenario binding.`,
        "Refresh the exact test-run result and rebuild the evaluation envelope.",
        { runId: receipt.runId, scenarioId: receipt.scenarioId },
      );
    }
  });

  for (const binding of envelope.runBindings) {
    if (!seenRunIds.has(binding.runId)) {
      addFinding(
        findings,
        "run_binding_unexpected",
        `Evaluation binding ${binding.runId} has no submitted test-run request.`,
        "Remove the stale binding or submit the exact governed run request.",
        { runId: binding.runId, scenarioId: binding.scenarioId },
      );
    }
  }

  if (receipts.length > 0) {
    const first = resultEnvelopeDigests(
      testRunResults[0]!,
      request.testRunRequests[0]!,
    );
    if (
      envelope.caseId !== first.caseId ||
      envelope.qualificationContractDigest !==
        first.qualificationContractDigest ||
      envelope.asBuiltReceiptDigest !== first.asBuiltReceiptDigest ||
      envelope.preflightReceiptDigest !== first.preflightReceiptDigest
    ) {
      addFinding(
        findings,
        "evaluation_upstream_digest_mismatch",
        "The evaluation envelope is not bound to the exact target case, qualification, as-built, and preflight chain.",
        "Rebuild the envelope from the admitted target execution chain.",
      );
    }
    for (let index = 1; index < receipts.length; index += 1) {
      const current = resultEnvelopeDigests(
        testRunResults[index]!,
        request.testRunRequests[index]!,
      );
      if (canonicalStringify(current) !== canonicalStringify(first)) {
        addFinding(
          findings,
          "evaluation_upstream_digest_mismatch",
          `Run ${receipts[index]!.runId} belongs to a different target execution chain.`,
          "Evaluate only runs sharing the exact target case, qualification, as-built, and preflight custody.",
          {
            runId: receipts[index]!.runId,
            scenarioId: receipts[index]!.scenarioId,
          },
        );
      }
    }
    const latestRunEnd = Math.max(
      ...receipts.map((receipt) => Date.parse(receipt.endedAt)),
    );
    if (
      Date.parse(envelope.evaluatedAt) < latestRunEnd ||
      Date.parse(request.admittedAt) < Date.parse(envelope.evaluatedAt)
    ) {
      addFinding(
        findings,
        "evaluation_time_order_invalid",
        "Mission evaluation predates the submitted run set or is admitted before evaluation completes.",
        "Restore chronology across run completion, evaluation, and admission.",
      );
    }
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
      "The envelope attempts to claim unrestricted equivalence from bounded target runs.",
      "Keep mission equivalence false; report only the bounded target adequacy state returned by the existing evaluator.",
    );
  }

  const embeddedReceipts = collectTestRunReceipts(
    request.custodiedMissionEvaluationArgs,
  );
  const embeddedByRun = new Map(
    embeddedReceipts.map((receipt) => [receipt.runId, receipt]),
  );
  for (const receipt of receipts) {
    const embedded = embeddedByRun.get(receipt.runId);
    if (!embedded) {
      addFinding(
        findings,
        "run_omitted_from_custodied_evaluation",
        `Admitted run ${receipt.runId} is absent from the delegated custodied evaluation.`,
        "Include every governed run receipt in the existing mission-evaluation request.",
        { runId: receipt.runId, scenarioId: receipt.scenarioId },
      );
    } else if (canonicalStringify(embedded) !== canonicalStringify(receipt)) {
      addFinding(
        findings,
        "run_receipt_mismatch",
        `Delegated run ${receipt.runId} differs from the admitted Commons-seeded receipt.`,
        "Use the exact immutable run receipt without normalization or selective mutation.",
        { runId: receipt.runId, scenarioId: receipt.scenarioId },
      );
    }
  }
  const receiptIds = new Set(receipts.map((receipt) => receipt.runId));
  for (const embedded of embeddedReceipts) {
    if (!receiptIds.has(embedded.runId)) {
      addFinding(
        findings,
        "unbound_run_in_custodied_evaluation",
        `Delegated evaluation includes run ${embedded.runId} without Commons-seeded custody.`,
        "Submit and admit the corresponding Commons-seeded test-run request or remove the run from this evaluation.",
        { runId: embedded.runId, scenarioId: embedded.scenarioId },
      );
    }
  }

  const requiredCounts = requiredScenarioCounts(request.testRunRequests[0]);
  for (const [scenarioId, required] of requiredCounts) {
    const validCount = receipts.filter(
      (receipt) =>
        receipt.scenarioId === scenarioId && receipt.state === "valid",
    ).length;
    if (validCount < required) {
      addFinding(
        findings,
        "run_set_incomplete",
        `Scenario ${scenarioId} has ${validCount} valid runs; ${required} are required by the frozen qualification contract.`,
        "Complete and receipt the remaining reserved target executions before final mission evaluation.",
        { scenarioId },
      );
    }
  }

  let custodiedResult: unknown;
  let custodiedDigest = "";
  let missionState: CommonsSeededMissionState | undefined;
  try {
    custodiedResult = (
      runCustodiedMissionEvaluation as unknown as (
        ...args: unknown[]
      ) => unknown
    )(...request.custodiedMissionEvaluationArgs);
    custodiedDigest = canonicalDigest(custodiedResult);
    missionState = missionStateOf(custodiedResult);
    if (!missionState) {
      addFinding(
        findings,
        "custodied_evaluation_state_missing",
        "The existing custodied mission evaluator returned no recognized mission-adequacy state.",
        "Repair the target evaluation request and preserve the existing evaluator result.",
      );
    }
  } catch (error) {
    addFinding(
      findings,
      "custodied_evaluation_failed",
      `The existing custodied mission evaluator failed: ${String(error)}.`,
      "Repair the delegated target evaluation request without weakening run custody.",
    );
  }

  const failedMetricIds = dedupe(
    receipts.flatMap((receipt) =>
      receipt.metricResults
        .filter((metric) => metric.thresholdResult === "fail")
        .map((metric) => metric.metricId),
    ),
  );
  const blockingStates = new Set<
    CommonsSeededMissionEvaluationFinding["state"]
  >([
    "mission_evaluation_validation_failed",
    "test_run_result_mismatch",
    "run_binding_mismatch",
    "run_set_duplicate",
    "run_omitted_from_custodied_evaluation",
    "unbound_run_in_custodied_evaluation",
    "run_receipt_mismatch",
    "evaluation_envelope_digest_mismatch",
    "evaluation_case_mismatch",
    "evaluation_upstream_digest_mismatch",
    "qualification_transfer_attempted",
    "mission_equivalence_attempted",
    "custodied_evaluation_failed",
    "custodied_evaluation_state_missing",
  ]);
  const state =
    findings.length === 0
      ? "seeded_mission_evaluation_admitted"
      : findings.some((finding) => blockingStates.has(finding.state))
        ? "seeded_mission_evaluation_blocked"
        : "seeded_mission_evaluation_incomplete";

  return {
    passed: state === "seeded_mission_evaluation_admitted",
    state,
    missionState,
    custodiedMissionEvaluationResult: custodiedResult,
    custodiedMissionEvaluationResultDigest: custodiedDigest,
    evaluationEnvelopeDigest: envelopeDigest,
    admittedTestRunResultDigests: resultDigests,
    admittedRunIds: receipts.map((receipt) => receipt.runId),
    validRunIds: receipts
      .filter((receipt) => receipt.state === "valid")
      .map((receipt) => receipt.runId),
    failedMetricIds,
    abortedRunIds: receipts
      .filter((receipt) => receipt.state === "aborted")
      .map((receipt) => receipt.runId),
    invalidatedRunIds: receipts
      .filter((receipt) => receipt.state === "invalidated")
      .map((receipt) => receipt.runId),
    incompleteRunIds: receipts
      .filter((receipt) => receipt.state === "incomplete")
      .map((receipt) => receipt.runId),
    findings,
    validationErrors: [],
    testRunResults,
    testRunReceipts: receipts,
    pullList: dedupe(findings.map((finding) => finding.requiredAction)),
    prohibitedTransitions: [
      ...COMMONS_SEEDED_MISSION_EVALUATION_PROHIBITED_TRANSITIONS,
    ],
  };
}
