import type { TestRunReceipt, ThresholdResult } from "../../types/garpaExecution";
import type {
  CommonsSeededTestRunFinding,
  CommonsSeededTestRunRequest,
  CommonsSeededTestRunResult,
  CommonsSeededThresholdSummary,
} from "../../types/garpaCommonsSeededTestRun";
import {
  computeCommonsSeededTestRunEnvelopeDigest,
  computeCommonsSeededTestRunReceiptDigest,
  computeSeededExecutionConfigurationDigest,
} from "./commonsSeededTestRunDigest";
import { computeCommonsSeededPreflightResultDigest } from "./commonsSeededPreflightDigest";
import { runCommonsSeededPreflightGate } from "./runCommonsSeededPreflightGate";
import { validateCommonsSeededTestRunRequest } from "./validateCommonsSeededTestRun";

export const COMMONS_SEEDED_TEST_RUN_PROHIBITED_TRANSITIONS = [
  "Admission of a coherent run receipt does not mean that its metrics passed.",
  "A measured pass, failure, abort, invalidation, or incomplete run cannot by itself establish mission adequacy, vendor parity, deployment authority, or publication authority.",
  "Any run identity, scenario, as-built digest, configuration, fixture, environment, operator, instrumentation, clock, storage, authority, or preflight change requires a new reservation and preflight receipt.",
] as const;

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function exactSet(left: string[], right: string[]): boolean {
  const a = dedupe(left).sort();
  const b = dedupe(right).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function addFinding(
  findings: CommonsSeededTestRunFinding[],
  state: CommonsSeededTestRunFinding["state"],
  reason: string,
  requiredAction: string,
  coordinates: Partial<CommonsSeededTestRunFinding> = {},
): void {
  findings.push({ state, reason, requiredAction, ...coordinates });
}

function thresholdSummary(receipt: TestRunReceipt): CommonsSeededThresholdSummary {
  const byMetricId: Record<string, ThresholdResult> = {};
  for (const result of receipt.metricResults) {
    byMetricId[result.metricId] = result.thresholdResult;
  }
  return {
    passMetricIds: receipt.metricResults
      .filter((result) => result.thresholdResult === "pass")
      .map((result) => result.metricId),
    failMetricIds: receipt.metricResults
      .filter((result) => result.thresholdResult === "fail")
      .map((result) => result.metricId),
    inconclusiveMetricIds: receipt.metricResults
      .filter((result) => result.thresholdResult === "inconclusive")
      .map((result) => result.metricId),
    notMeasuredMetricIds: receipt.metricResults
      .filter((result) => result.thresholdResult === "not_measured")
      .map((result) => result.metricId),
    byMetricId,
  };
}

function referencedArtifactIds(receipt: TestRunReceipt): string[] {
  return dedupe([
    ...receipt.rawDataArtifactIds,
    ...receipt.logArtifactIds,
    ...receipt.observationArtifactIds,
    ...receipt.metricResults.flatMap((result) => result.rawSampleArtifactIds),
    ...receipt.aborts.flatMap((abort) => abort.evidenceArtifactIds ?? []),
  ]);
}

function emptyThresholdSummary(): CommonsSeededThresholdSummary {
  return {
    passMetricIds: [],
    failMetricIds: [],
    inconclusiveMetricIds: [],
    notMeasuredMetricIds: [],
    byMetricId: {},
  };
}

export function runCommonsSeededTestRunGate(
  input: CommonsSeededTestRunRequest | unknown,
): CommonsSeededTestRunResult {
  const validated = validateCommonsSeededTestRunRequest(input);
  if (!validated.ok || !validated.value) {
    return {
      passed: false,
      state: "seeded_test_run_blocked",
      seededPreflightResultDigest: "",
      preflightReceiptDigest: "",
      executionEnvelopeDigest: "",
      testRunResultDigest: "",
      runId: "",
      scenarioId: "",
      thresholdSummary: emptyThresholdSummary(),
      findings: validated.errors.map((reason) => ({
        state: "test_run_validation_failed" as const,
        reason,
        requiredAction:
          "Repair the Commons-seeded test-run request and rerun validation.",
      })),
      validationErrors: validated.errors,
      pullList: validated.errors,
      prohibitedTransitions: [...COMMONS_SEEDED_TEST_RUN_PROHIBITED_TRANSITIONS],
    };
  }

  const request = validated.value;
  const preflightResult = runCommonsSeededPreflightGate(
    request.seededPreflightRequest,
  );
  const preflightResultDigest =
    computeCommonsSeededPreflightResultDigest(preflightResult);
  const preflightReceipt = request.seededPreflightRequest.preflightReceipt;
  const run = request.testRunReceipt;
  const envelope = request.executionEnvelope;
  const envelopeDigest = computeCommonsSeededTestRunEnvelopeDigest(envelope);
  const resultDigest = computeCommonsSeededTestRunReceiptDigest(run);
  const asBuilt =
    request.seededPreflightRequest.seededBuildReceiptRequest.asBuiltReceipt;
  const qualification =
    request.seededPreflightRequest.seededBuildReceiptRequest
      .seededBuildManifestRequest.seededQualificationRequest
      .qualificationContract;
  const scenario = qualification.scenarios.find(
    (candidate) => candidate.id === run.scenarioId,
  );
  const reservation = preflightReceipt.runReservations.find(
    (candidate) => candidate.runId === run.runId,
  );
  const findings: CommonsSeededTestRunFinding[] = [];

  if (
    request.expectedSeededPreflightResultDigest !== preflightResultDigest ||
    envelope.seededPreflightResultDigest !== preflightResultDigest
  ) {
    addFinding(
      findings,
      "seeded_preflight_result_mismatch",
      "The expected or enveloped preflight result digest does not match deterministic recomputation.",
      "Refresh the admitted preflight result and bind execution to its canonical digest.",
      { runId: run.runId },
    );
  }
  if (!preflightResult.passed) {
    addFinding(
      findings,
      "seeded_preflight_not_admitted",
      "The governing Commons-seeded preflight is not admitted for reserved execution.",
      "Resolve every preflight and ordinary readiness finding before executing a run.",
      { runId: run.runId },
    );
  }
  if (envelope.envelopeDigest !== envelopeDigest) {
    addFinding(
      findings,
      "execution_envelope_digest_mismatch",
      "The execution-envelope digest does not match its canonical content.",
      "Restore the immutable execution envelope and recompute its digest.",
      { runId: run.runId },
    );
  }
  if (run.resultDigest !== resultDigest) {
    addFinding(
      findings,
      "test_run_result_digest_mismatch",
      "The test-run result digest does not match its canonical content.",
      "Restore the immutable run receipt and recompute its result digest.",
      { runId: run.runId },
    );
  }
  if (run.caseId !== asBuilt.caseId || envelope.caseId !== asBuilt.caseId) {
    addFinding(
      findings,
      "test_run_case_mismatch",
      "The run or execution envelope belongs to a different target case.",
      "Execute and receipt the exact preflighted target case.",
      { runId: run.runId },
    );
  }
  if (
    run.buildDigest !== asBuilt.receiptDigest ||
    run.qualificationContractDigest !== asBuilt.qualificationContractDigest ||
    envelope.asBuiltReceiptDigest !== asBuilt.receiptDigest ||
    envelope.preflightReceiptDigest !== preflightReceipt.receiptDigest ||
    envelope.qualificationContractDigest !== asBuilt.qualificationContractDigest
  ) {
    addFinding(
      findings,
      "test_run_upstream_digest_mismatch",
      "The run is not bound to the exact as-built, preflight, and qualification chain.",
      "Regenerate the run reservation and receipt after restoring the current upstream digests.",
      { runId: run.runId },
    );
  }
  if (
    Date.parse(run.startedAt) < Date.parse(preflightReceipt.preflightAt) ||
    Date.parse(run.endedAt) < Date.parse(run.startedAt) ||
    Date.parse(envelope.executedAt) < Date.parse(run.endedAt) ||
    Date.parse(request.admittedAt) < Date.parse(envelope.executedAt)
  ) {
    addFinding(
      findings,
      "test_run_time_order_invalid",
      "Execution predates preflight, ends before it starts, or is admitted before completion.",
      "Restore chronology across preflight, execution, envelope capture, and admission.",
      { runId: run.runId },
    );
  }

  if (!reservation) {
    addFinding(
      findings,
      "run_reservation_missing",
      `Run ${run.runId} was not reserved by the governing preflight receipt.`,
      "Reserve a unique run identifier under a fresh preflight receipt.",
      { runId: run.runId },
    );
  } else if (
    reservation.scenarioId !== run.scenarioId ||
    reservation.reservationReceiptId !== envelope.runReservationReceiptId
  ) {
    addFinding(
      findings,
      "run_reservation_scenario_mismatch",
      "The run scenario or reservation receipt differs from the frozen reservation.",
      "Execute only the exact reserved scenario under its reservation receipt.",
      { runId: run.runId, scenarioId: run.scenarioId },
    );
  }

  const expectedConfiguration =
    computeSeededExecutionConfigurationDigest(request.seededPreflightRequest);
  if (run.configurationDigest !== expectedConfiguration) {
    addFinding(
      findings,
      "execution_configuration_mismatch",
      "The run configuration does not match the preflighted as-built, fixtures, and instruments.",
      "Return changed configuration through preflight and reserve a successor run.",
      { runId: run.runId },
    );
  }

  const assignedOperators = preflightReceipt.operatorChecks
    .filter((check) => check.state === "ready")
    .map((check) => check.actor);
  if (!exactSet(run.operators, assignedOperators)) {
    addFinding(
      findings,
      "operator_assignment_mismatch",
      "The run operators differ from the trained actors admitted at preflight.",
      "Use the exact preflighted operators or rerun operator readiness.",
      { runId: run.runId },
    );
  }

  for (const fixture of preflightReceipt.fixtureChecks) {
    if (run.fixtureState[fixture.fixtureId] !== fixture.configurationDigest) {
      addFinding(
        findings,
        "fixture_state_mismatch",
        `Run fixture ${fixture.fixtureId} does not match the preflight configuration digest.`,
        "Restore the exact fixture state or issue a new preflight receipt.",
        { runId: run.runId },
      );
    }
  }

  if (!scenario) {
    addFinding(
      findings,
      "run_reservation_scenario_mismatch",
      `Scenario ${run.scenarioId} is absent from the frozen qualification contract.`,
      "Bind execution to an existing frozen qualification scenario.",
      { runId: run.runId, scenarioId: run.scenarioId },
    );
  } else {
    const environmentMatches = Object.entries(scenario.environment).every(
      ([dimension, expected]) =>
        run.environmentObserved[dimension] === String(expected),
    );
    if (!environmentMatches) {
      addFinding(
        findings,
        "environment_observation_mismatch",
        "The observed environment does not contain the exact frozen scenario dimensions and values.",
        "Preserve the observed deviation and rerun or requalify the changed environment.",
        { runId: run.runId, scenarioId: run.scenarioId },
      );
    }

    const resultByMetric = new Map(
      run.metricResults.map((result) => [result.metricId, result]),
    );
    for (const metricId of scenario.metricIds) {
      const result = resultByMetric.get(metricId);
      if (!result) {
        addFinding(
          findings,
          "required_metric_missing",
          `Required scenario metric ${metricId} has no result.`,
          "Preserve a result or explicit not-measured disposition for every frozen metric.",
          { runId: run.runId, metricId },
        );
        continue;
      }
      const contractMetric = qualification.metrics.find(
        (metric) => metric.id === metricId,
      );
      const requiredSamples = contractMetric?.requiredRuns ?? 0;
      if (run.state === "valid" && result.sampleCount < requiredSamples) {
        addFinding(
          findings,
          "required_sample_count_incomplete",
          `Metric ${metricId} has ${result.sampleCount} samples but requires ${requiredSamples}.`,
          "Collect the frozen number of valid samples or mark the run incomplete.",
          { runId: run.runId, metricId },
        );
      }
    }
  }

  const artifactIds = new Set(
    envelope.artifacts.map((artifact) => artifact.artifactId),
  );
  for (const artifactId of referencedArtifactIds(run)) {
    if (!artifactIds.has(artifactId)) {
      addFinding(
        findings,
        "raw_artifact_custody_missing",
        `Run references artifact ${artifactId} without an immutable envelope record.`,
        "Add a content-addressed artifact record for every raw, log, observation, sample, and abort-evidence reference.",
        { runId: run.runId, artifactId },
      );
    }
  }

  const invalidatingAnomalies = run.anomalies.filter(
    (anomaly) => anomaly.disposition === "invalidates_run",
  );
  if (run.state === "valid" && run.aborts.length > 0) {
    addFinding(
      findings,
      "valid_run_contains_abort",
      "A run marked valid contains an abort receipt.",
      "Mark the run aborted or remove only an erroneously attached abort through a superseding receipt.",
      { runId: run.runId },
    );
  }
  if (run.state === "valid" && invalidatingAnomalies.length > 0) {
    addFinding(
      findings,
      "valid_run_contains_invalidating_anomaly",
      "A run marked valid contains an anomaly that invalidates the run.",
      "Mark the run invalidated and retain the anomaly receipt.",
      { runId: run.runId },
    );
  }
  if (run.state === "aborted" && run.aborts.length === 0) {
    addFinding(
      findings,
      "aborted_run_missing_abort_receipt",
      "An aborted run lacks an abort receipt.",
      "Record the abort authority, time, reason, and evidence custody.",
      { runId: run.runId },
    );
  }
  if (run.state === "invalidated" && invalidatingAnomalies.length === 0) {
    addFinding(
      findings,
      "invalidated_run_missing_invalidation_receipt",
      "An invalidated run lacks an invalidating anomaly receipt.",
      "Record the anomaly that invalidated the run.",
      { runId: run.runId },
    );
  }
  if (run.state === "incomplete") {
    addFinding(
      findings,
      "test_run_state_incomplete",
      "The run receipt remains incomplete.",
      "Complete the receipt or preserve it as an incomplete execution without evaluation authority.",
      { runId: run.runId },
    );
  }
  if (envelope.qualificationTransferred !== false) {
    addFinding(
      findings,
      "qualification_transfer_attempted",
      "The execution envelope attempts to transfer qualification into the target run.",
      "Keep qualification transfer structurally false and evaluate only target measurements.",
      { runId: run.runId },
    );
  }
  if (envelope.missionEquivalenceClaimed !== false) {
    addFinding(
      findings,
      "mission_equivalence_attempted",
      "The execution envelope attempts to claim mission equivalence from one run.",
      "Keep mission equivalence false until target evaluation and comparison gates pass.",
      { runId: run.runId },
    );
  }

  const blockingStates = new Set<CommonsSeededTestRunFinding["state"]>([
    "seeded_preflight_result_mismatch",
    "seeded_preflight_not_admitted",
    "execution_envelope_digest_mismatch",
    "test_run_result_digest_mismatch",
    "test_run_case_mismatch",
    "test_run_upstream_digest_mismatch",
    "run_reservation_missing",
    "run_reservation_scenario_mismatch",
    "qualification_transfer_attempted",
    "mission_equivalence_attempted",
  ]);
  const state = findings.some((finding) => blockingStates.has(finding.state))
    ? "seeded_test_run_blocked"
    : findings.length > 0
      ? "seeded_test_run_incomplete"
      : "seeded_test_run_admitted";

  return {
    passed: state === "seeded_test_run_admitted",
    state,
    seededPreflightResult: preflightResult,
    seededPreflightResultDigest: preflightResultDigest,
    preflightReceiptDigest: preflightReceipt.receiptDigest,
    executionEnvelopeDigest: envelopeDigest,
    testRunResultDigest: resultDigest,
    runId: run.runId,
    scenarioId: run.scenarioId,
    testRunState: run.state,
    thresholdSummary: thresholdSummary(run),
    findings,
    validationErrors: [],
    testRunReceipt: run,
    executionEnvelope: envelope,
    pullList: dedupe(findings.map((finding) => finding.requiredAction)),
    prohibitedTransitions: [...COMMONS_SEEDED_TEST_RUN_PROHIBITED_TRANSITIONS],
  };
}
