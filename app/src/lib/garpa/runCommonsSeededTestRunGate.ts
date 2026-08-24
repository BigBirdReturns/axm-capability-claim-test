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

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function records(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function exactSet(left: string[], right: string[]): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
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

function findObject(
  root: unknown,
  predicate: (value: RecordValue) => boolean,
  seen = new Set<unknown>(),
): RecordValue | undefined {
  if (seen.has(root)) return undefined;
  seen.add(root);
  if (isRecord(root)) {
    if (predicate(root)) return root;
    for (const value of Object.values(root)) {
      const found = findObject(value, predicate, seen);
      if (found) return found;
    }
  } else if (Array.isArray(root)) {
    for (const value of root) {
      const found = findObject(value, predicate, seen);
      if (found) return found;
    }
  }
  return undefined;
}

function qualificationContract(request: CommonsSeededTestRunRequest): RecordValue {
  return (
    findObject(
      request.seededPreflightRequest,
      (value) =>
        Array.isArray(value.scenarios) &&
        Array.isArray(value.metrics) &&
        Array.isArray(value.instrumentation) &&
        isRecord(value.acceptanceRule),
    ) ?? {}
  );
}

function thresholdSummary(receipt: TestRunReceipt): CommonsSeededThresholdSummary {
  const byMetricId: Record<string, ThresholdResult> = {};
  for (const result of receipt.metricResults) {
    byMetricId[result.metricId] = result.thresholdResult;
  }
  return {
    passMetricIds: receipt.metricResults
      .filter((item) => item.thresholdResult === "pass")
      .map((item) => item.metricId),
    failMetricIds: receipt.metricResults
      .filter((item) => item.thresholdResult === "fail")
      .map((item) => item.metricId),
    inconclusiveMetricIds: receipt.metricResults
      .filter((item) => item.thresholdResult === "inconclusive")
      .map((item) => item.metricId),
    notMeasuredMetricIds: receipt.metricResults
      .filter((item) => item.thresholdResult === "not_measured")
      .map((item) => item.metricId),
    byMetricId,
  };
}

function referencedArtifactIds(receipt: TestRunReceipt): string[] {
  return dedupe([
    ...receipt.rawDataArtifactIds,
    ...receipt.logArtifactIds,
    ...receipt.observationArtifactIds,
    ...receipt.metricResults.flatMap((item) => item.rawSampleArtifactIds),
  ]);
}

function observedEnvironmentMatches(
  observed: Record<string, string>,
  expected: RecordValue,
): boolean {
  return Object.entries(expected).every(
    ([key, value]) => observed[key] === String(value),
  );
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
      thresholdSummary: {
        passMetricIds: [],
        failMetricIds: [],
        inconclusiveMetricIds: [],
        notMeasuredMetricIds: [],
        byMetricId: {},
      },
      findings: validated.errors.map((reason) => ({
        state: "test_run_validation_failed" as const,
        reason,
        requiredAction: "Repair the Commons-seeded test-run request and rerun validation.",
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
  const qualification = qualificationContract(request);
  const scenarios = records(qualification.scenarios);
  const metrics = records(qualification.metrics);
  const scenario = scenarios.find((item) => String(item.id) === run.scenarioId);
  const reservation = preflightReceipt.runReservations.find(
    (item) => item.runId === run.runId,
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
  if (en²È="25…‘‘¥¹‘¥¹œ (€€€€€™¥¹‘¥¹Ì°(€€€€€€‰•á•ÕÑ¥½¹}½¹™¥ÕÉ…Ñ¥½¹}µ¥Íµ…Ñ ˆ°(€€€€€€‰Q¡”ÉÕ¸½¹™¥ÕÉ…Ñ¥½¸‘½•Ì¹½Ðµ…Ñ Ñ¡”ÁÉ•™±¥¡Ñ•…Ìµ‰Õ¥±Ð°™¥áÑÕÉ•Ì°…¹¥¹ÍÑÉÕµ•¹ÑÌ¸ˆ°(€€€€€€‰I•ÑÕÉ¸¡…¹•½¹™¥ÕÉ…Ñ¥½¸Ñ¡É½Õ ÁÉ•™±¥¡Ð…¹É•Í•ÉÙ”„ÍÕ•ÍÍ½ÈÉÕ¸¸ˆ°(€€€€€ìÉÕ¹%èÉÕ¸¹ÉÕ¹%ô°(€€€€¤ì(€ô((€½¹ÍÐ…ÍÍ¥¹•‘=Á•É…Ñ½ÉÌ€ôÁÉ•™±¥¡ÑI••¥ÁÐ¹½Á•É…Ñ½É¡•­Ì(€€€€¹™¥±Ñ•È ¡¥Ñ•´¤€ôø¥Ñ•´¹ÍÑ…Ñ”€ôôô€‰É•…‘äˆ¤(€€€€¹µ…À ¡¥Ñ•´¤€ôø¥Ñ•´¹…Ñ½È¤ì(€¥˜€ …•á…ÑM•Ð¡ÉÕ¸¹½Á•É…Ñ½ÉÌ°…ÍÍ¥¹•‘=Á•É…Ñ½ÉÌ¤¤ì(€€€…‘‘¥¹‘¥¹œ (€€€€€™¥¹‘¥¹Ì°(€€€€€€‰½Á•É…Ñ½É}…ÍÍ¥¹µ•¹Ñ}µ¥Íµ…Ñ ˆ°(€€€€€€‰Q¡”ÉÕ¸½Á•É…Ñ½ÉÌ‘¥™™•È™É½´Ñ¡”ÑÉ…¥¹•…Ñ½ÉÌ…‘µ¥ÑÑ•…ÐÁÉ•™±¥¡Ð¸ˆ°(€€€€€€‰UÍ”Ñ¡”•á…ÐÁÉ•™±¥¡Ñ•½Á•É…Ñ½ÉÌ½ÈÉ•ÉÕ¸½Á•É…Ñ½ÈÉ•…‘¥¹•ÍÌ¸ˆ°(€€€€€ìÉÕ¹%èÉÕ¸¹ÉÕ¹%ô°(€€€€¤ì(€ô((€™½È€¡½¹ÍÐ™¥áÑÕÉ”½˜ÁÉ•™±¥¡ÑI••¥ÁÐ¹™¥áÑÕÉ•¡•­Ì¤ì(€€€¥˜€¡ÉÕ¸¹™¥áÑÕÉ•MÑ…Ñ•m™¥áÑÕÉ”¹™¥áÑÕÉ•%‘t€„ôô™¥áÑÕÉ”¹½¹™¥ÕÉ…Ñ¥½¹¥•ÍÐ¤ì(€€€€€…‘‘¥¹‘¥¹œ (€€€€€€€™¥¹‘¥¹Ì°(€€€€€€€€‰™¥áÑÕÉ•}ÍÑ…Ñ•}µ¥Íµ…Ñ ˆ°(€€€€€€€IÕ¸™¥áÑÕÉ”€‘í™¥áÑÕÉ”¹™¥áÑÕÉ•%‘ô‘½•Ì¹½Ðµ…Ñ Ñ¡”ÁÉ•™±¥¡Ð½¹™¥ÕÉ…Ñ¥½¸‘¥•ÍÐ¹€°(€€€€€€€€‰I•ÍÑ½É”Ñ¡”•á…Ð™¥áÑÕÉ”ÍÑ…Ñ”½È¥ÍÍÕ”„¹•ÜÁÉ•™±¥¡ÐÉ••¥ÁÐ¸ˆ°(€€€€€€€ìÉÕ¹%èÉÕ¸¹ÉÕ¹%ô°(€€€€€€¤ì(€€€ô(€ô(€¥˜€ …Í•¹…É¥¼¤ì(€€€…‘‘¥¹‘¥¹œ (€€€€€™¥¹‘¥¹Ì°(€€€€€€‰ÉÕ¹}É•Í•ÉÙ…Ñ¥½¹}Í•¹…É¥½}µ¥Íµ…Ñ ˆ°(€€€€€M•¹…É¥¼€‘íÉÕ¸¹Í•¹…É¥½%‘ô¥Ì…‰Í•¹Ð™É½´Ñ¡”™É½é•¸ÅÕ…±¥™¥…Ñ¥½¸½¹ÑÉ…Ð¹€°(€€€€€€‰	¥¹•á•ÕÑ¥½¸Ñ¼…¸•á¥ÍÑ¥¹œ™É½é•¸ÅÕ…±¥™¥…Ñ¥½¸Í•¹…É¥¼¸ˆ°(€€€€€ìÉÕ¹%èÉÕ¸¹ÉÕ¹%°Í•¹…É¥½%èÉÕ¸¹Í•¹…É¥½%ô°(€€€€¤ì(€ô•±Í”ì(€€€½¹ÍÐ•áÁ•Ñ•‘¹Ù¥É½¹µ•¹Ð€ô¥ÍI•½É¡Í•¹…É¥¼¹•¹Ù¥É½¹µ•¹Ð¤(€€€€€€üÍ•¹…É¥¼¹•¹Ù¥É½¹µ•¹Ð(€€€€€€èíôì(€€€¥˜€ …½‰Í•ÉÙ•‘¹Ù¥É½¹µ•¹Ñ5…Ñ¡•Ì¡ÉÕ¸¹•¹Ù¥É½¹µ•¹Ñ=‰Í•ÉÙ•°•áÁ•Ñ•‘¹Ù¥É½¹µ•¹Ð¤¤ì(€€€€€…‘‘¥¹‘¥¹œ (€€€€€€€™¥¹‘¥¹Ì°(€€€€€€€€‰•¹Ù¥É½¹µ•¹Ñ}½‰Í•ÉÙ…Ñ¥½¹}µ¥Íµ…Ñ ˆ°(€€€€€€€€‰Q¡”½‰Í•ÉÙ••¹Ù¥É½¹µ•¹Ð‘½•Ì¹½Ð½¹Ñ…¥¸Ñ¡”•á…Ð™É½é•¸Í•¹…É¥¼‘¥µ•¹Í¥½¹Ì…¹Ù…±Õ•Ì¸ˆ°(€€€€€€€€‰AÉ•Í•ÉÙ”Ñ¡”½‰Í•ÉÙ•‘•Ù¥…Ñ¥½¸…¹É•ÉÕ¸½ÈÉ•ÅÕ…±¥™äÑ¡”¡…¹••¹Ù¥É½¹µ•¹Ð¸ˆ°(€€€€€€€ìÉÕ¹%èÉÕ¸¹ÉÕ¹%°Í•¹…É¥½%èÉÕ¸¹Í•¹…É¥½%ô°(€€€€€€¤ì(€€€ô((€€€½¹ÍÐÉ•ÅÕ¥É•‘5•ÑÉ¥%‘Ì€ôÍÑÉ¥¹Ì¡Í•¹…É¥¼¹µ•ÑÉ¥%‘Ì¤ì(€€€½¹ÍÐÉ•ÍÕ±Ñ	å5•ÑÉ¥Œ€ô¹•Ü5…À (€€€€€ÉÕ¸¹µ•ÑÉ¥I•ÍÕ±ÑÌ¹µ…À ¡¥Ñ•´¤€ôøm¥Ñ•´¹µ•ÑÉ¥%°¥Ñ•µt¤°(€€€€¤ì(€€€™½È€¡½¹ÍÐµ•ÑÉ¥%½˜É•ÅÕ¥É•‘5•ÑÉ¥%‘Ì¤ì(€€€€€½¹ÍÐÉ•ÍÕ±Ð€ôÉ•ÍÕ±Ñ	å5•ÑÉ¥Œ¹•Ð¡µ•ÑÉ¥%¤ì(€€€€€¥˜€ …É•ÍÕ±Ð¤ì(€€€€€€€…‘‘¥¹‘¥¹œ (€€€€€€€€€™¥¹‘¥¹Ì°(€€€€€€€€€€‰É•ÅÕ¥É•‘}µ•ÑÉ¥}µ¥ÍÍ¥¹œˆ°(€€€€€€€€€I•ÅÕ¥É•Í•¹…É¥¼µ•ÑÉ¥Œ€‘íµ•ÑÉ¥%‘ô¡…Ì¹¼É•ÍÕ±Ð¹€°(€€€€€€€€€€‰AÉ•Í•ÉÙ”„É•ÍÕ±Ð½È•áÁ±¥¥Ð¹½Ðµµ•…ÍÕÉ•‘¥ÍÁ½Í¥Ñ¥½¸™½È•Ù•Éä™É½é•¸µ•ÑÉ¥Œ¸ˆ°(€€€€€€€€€ìÉÕ¹%èÉÕ¸¹ÉÕ¹%°µ•ÑÉ¥%ô°(€€€€€€€€¤ì(€€€€€€€½¹Ñ¥¹Õ”ì(€€€€€ô(€€€€€½¹ÍÐ½¹ÑÉ…Ñ5•ÑÉ¥Œ€ôµ•ÑÉ¥Ì¹™¥¹ (€€€€€€€€¡¥Ñ•´¤€ôøMÑÉ¥¹œ¡¥Ñ•´¹¥¤€ôôôµ•ÑÉ¥%°(€€€€€€¤ì(€€€€€½¹ÍÐÉ•ÅÕ¥É•‘IÕ¹Ì€ô9Õµ‰•È¡½¹ÑÉ…Ñ5•ÑÉ¥Œü¹É•ÅÕ¥É•‘IÕ¹Ì€üü€À¤ì(€€€€€¥˜€ (€€€€€€€ÉÕ¸¹ÍÑ…Ñ”€ôôô€‰Ù…±¥ˆ€˜˜(€€€€€€€9Õµ‰•È¹¥Í¥¹¥Ñ”¡É•ÅÕ¥É•‘IÕ¹Ì¤€˜˜(€€€€€€€É•ÍÕ±Ð¹Í…µÁ±•½Õ¹Ð€ðÉ•ÅÕ¥É•‘IÕ¹Ì(€€€€€€¤ì(€€€€€€€…‘‘¥¹‘¥¹œ (€€€€€€€€€™¥¹‘¥¹Ì°(€€€€€€€€€€‰É•ÅÕ¥É•‘}Í…µÁ±•}½Õ¹Ñ}¥¹½µÁ±•Ñ”ˆ°(€€€€€€€€€5•ÑÉ¥Œ€‘íµ•ÑÉ¥%‘ô¡…Ì€‘íÉ•ÍÕ±Ð¹Í…µÁ±•½Õ¹ÑôÍ…µÁ±•Ì‰ÕÐÉ•ÅÕ¥É•Ì€‘íÉ•ÅÕ¥É•‘IÕ¹Íô¹€°(€€€€€€€€€€‰½±±•ÐÑ¡”™É½é•¸¹Õµ‰•È½˜Ù…±¥Í…µÁ±•Ì½Èµ…É¬Ñ¡”ÉÕ¸¥¹½µÁ±•Ñ”¸ˆ°(€€€€€€€€€ìÉÕ¹%èÉÕ¸¹ÉÕ¹%°µ•ÑÉ¥%ô°(€€€€€€€€¤ì(€€€€€ô(€€€ô(€ô((€½¹ÍÐ…ÉÑ¥™…Ñ%‘Ì€ô¹•ÜM•Ð¡•¹Ù•±½Á”¹…ÉÑ¥™…ÑÌ¹µ…À ¡¥Ñ•´¤€ôø¥Ñ•´¹…ÉÑ¥™…Ñ%¤¤ì(€™½È€¡½¹ÍÐ…ÉÑ¥™…Ñ%½˜É•™•É•¹•‘ÉÑ¥™…Ñ%‘Ì¡ÉÕ¸¤¤ì(€€€¥˜€ ……ÉÑ¥™…Ñ%‘Ì¹¡…Ì¡…ÉÑ¥™…Ñ%¤¤ì(€€€€€…‘‘¥¹‘¥¹œ (€€€€€€€™¥¹‘¥¹Ì°(€€€€€€€€‰É…Ý}…ÉÑ¥™…Ñ}ÕÍÑ½‘å}µ¥ÍÍ¥¹œˆ°(€€€€€€€IÕ¸É•™•É•¹•Ì…ÉÑ¥™…Ð€‘í…ÉÑ¥™…Ñ%‘ôÝ¥Ñ¡½ÕÐ…¸¥µµÕÑ…‰±”•¹Ù•±½Á”É•½É¹€°(€€€€€€€€‰‘„½¹Ñ•¹Ðµ…‘‘É•ÍÍ•…ÉÑ¥™…ÐÉ•½É™½È•Ù•ÉäÉ…Ü°±½œ°½‰Í•ÉÙ…Ñ¥½¸°…¹Í…µÁ±”É•™•É•¹”¸ˆ°(€€€€€€€ìÉÕ¹%èÉÕ¸¹ÉÕ¹%°…ÉÑ¥™…Ñ%ô°(€€€€€€¤ì(€€€ô(€ô((€½¹ÍÐ¥¹Ù…±¥‘…Ñ¥¹¹½µ…±¥•Ì€ôÉÕ¸¹…¹½µ…±¥•Ì¹™¥±Ñ•È (€€€€¡¥Ñ•´¤€ôø¥Ñ•´¹‘¥ÍÁ½Í¥Ñ¥½¸€ôôô€‰¥¹Ù…±¥‘…Ñ•Í}ÉÕ¸ˆ°(€€¤ì(€¥˜€¡ÉÕ¸¹ÍÑ…Ñ”€ôôô€‰Ù…±¥ˆ€˜˜ÉÕ¸¹…‰½ÉÑÌ¹±•¹Ñ €ø€À¤ì(€€€…‘‘¥¹‘¥¹œ (€€€€€™¥¹‘¥¹Ì°(€€€€€€‰Ù…±¥‘}ÉÕ¹}½¹Ñ…¥¹Í}…‰½ÉÐˆ°(€€€€€€‰ÉÕ¸µ…É­•Ù…±¥½¹Ñ…¥¹Ì…¸…‰½ÉÐÉ••¥ÁÐ¸ˆ°(€€€€€€‰5…É¬Ñ¡”ÉÕ¸…‰½ÉÑ•½ÈÉ•µ½Ù”½¹±ä…¸•ÉÉ½¹•½ÕÍ±ä…ÑÑ…¡•…‰½ÉÐÑ¡É½Õ „ÍÕÁ•ÉÍ•‘¥¹œÉ••¥ÁÐ¸ˆ°(€€€€€ìÉÕ¹%èÉÕ¸¹ÉÕ¹%ô°(€€€€¤ì(€ô(€¥˜€¡ÉÕ¸¹ÍÑ…Ñ”€ôôô€‰Ù…±¥ˆ€˜˜¥¹Ù…±¥‘…Ñ¥¹¹½µ…±¥•Ì¹±•¹Ñ €ø€À¤ì(€€€…‘‘¥¹‘¥¹œ (€€€€€™¥¹‘¥¹Ì°(€€€€€€‰Ù…±¥‘}ÉÕ¹}½¹Ñ…¥¹Í}¥¹Ù…±¥‘…Ñ¥¹}…¹½µ…±äˆ°(€€€€€€‰ÉÕ¸µ…É­•Ù…±¥½¹Ñ…¥¹Ì…¸…¹½µ…±äÑ¡…Ð¥¹Ù…±¥‘…Ñ•ÌÑ¡”ÉÕ¸¸ˆ°(€€€€€€‰5…É¬Ñ¡”ÉÕ¸¥¹Ù…±¥‘…Ñ•…¹É•Ñ…¥¸Ñ¡”…¹½µ…±äÉ••¥ÁÐ¸ˆ°(€€€€€ìÉÕ¹%èÉÕ¸¹ÉÕ¹%ô°(€€€€¤ì(€ô(€¥˜€¡ÉÕ¸¹ÍÑ…Ñ”€ôôô€‰…‰½ÉÑ•ˆ€˜˜ÉÕ¸¹…‰½ÉÑÌ¹±•¹Ñ €ôôô€À¤ì(€€€…‘‘¥¹‘¥¹œ (€€€€€™¥¹‘¥¹Ì°(€€€€€€‰…‰½ÉÑ•‘}ÉÕ¹}µ¥ÍÍ¥¹}…‰½ÉÑ}É••¥ÁÐˆ°(€€€€€€‰¸…‰½ÉÑ•ÉÕ¸±…­Ì…¸…‰½ÉÐÉ••¥ÁÐ¸ˆ°(€€€€€€‰I•½ÉÑ¡”…‰½ÉÐ…ÕÑ¡½É¥Ñä°Ñ¥µ”°…¹É•…Í½¸¸ˆ°(€€€€€ìÉÕ¹%èÉÕ¸¹ÉÕ¹%ô°(€€€€¤ì(€ô(€¥˜€¡ÉÕ¸¹ÍÑ…Ñ”€ôôô€‰¥¹Ù…±¥‘…Ñ•ˆ€˜˜¥¹Ù…±¥‘…Ñ¥¹¹½µ…±¥•Ì¹±•¹Ñ €ôôô€À¤ì(€€€…‘‘¥¹‘¥¹œ (€€€€€™¥¹‘¥¹Ì°(€€€€€€‰¥¹Ù…±¥‘…Ñ•‘}ÉÕ¹}µ¥ÍÍ¥¹}¥¹Ù…±¥‘…Ñ¥½¹}É••¥ÁÐˆ°(€€€€€€‰¸¥¹Ù…±¥‘…Ñ•ÉÕ¸±…­Ì…¸¥¹Ù…±¥‘…Ñ¥¹œ…¹½µ…±äÉ••¥ÁÐ¸ˆ°(€€€€€€‰I•½ÉÑ¡”…¹½µ…±äÑ¡…Ð¥¹Ù…±¥‘…Ñ•Ñ¡”ÉÕ¸¸ˆ°(€€€€€ìÉÕ¹%èÉÕ¸¹ÉÕ¹%ô°(€€€€¤ì(€ô(€¥˜€¡ÉÕ¸¹ÍÑ…Ñ”€ôôô€‰¥¹½µÁ±•Ñ”ˆ¤ì(€€€…‘‘¥¹‘¥¹œ (€€€€€™¥¹‘¥¹Ì°(€€€€€€‰Ñ•ÍÑ}ÉÕ¹}ÍÑ…Ñ•}¥¹½µÁ±•Ñ”ˆ°(€€€€€€‰Q¡”ÉÕ¸É••¥ÁÐÉ•µ…¥¹Ì¥¹½µÁ±•Ñ”¸ˆ°(€€€€€€‰½µÁ±•Ñ”Ñ¡”É••¥ÁÐ½ÈÁÉ•Í•ÉÙ”¥Ð…Ì…¸¥¹½µÁ±•Ñ”•á•ÕÑ¥½¸Ý¥Ñ¡½ÕÐ•Ù…±Õ…Ñ¥½¸…ÕÑ¡½É¥Ñä¸ˆ°(€€€€€ìÉÕ¹%èÉÕ¸¹ÉÕ¹%ô°(€€€€¤ì(€ô(€¥˜€¡•¹Ù•±½Á”¹ÅÕ…±¥™¥…Ñ¥½¹QÉ…¹Í™•ÉÉ•€„ôô™…±Í”¤ì(€€€…‘‘¥¹‘¥¹œ (€€€€€™¥¹‘¥¹Ì°(€€€€€€‰ÅÕ…±¥™¥…Ñ¥½¹}ÑÉ…¹Í™•É}…ÑÑ•µÁÑ•ˆ°(€€€€€€‰Q¡”•á•ÕÑ¥½¸•¹Ù•±½Á”…ÑÑ•µÁÑÌÑ¼ÑÉ…¹Í™•ÈÅÕ…±¥™¥…Ñ¥½¸¥¹Ñ¼Ñ¡”Ñ…É•ÐÉÕ¸¸ˆ°(€€€€€€‰-••ÀÅÕ…±¥™¥…Ñ¥½¸ÑÉ…¹Í™•ÈÍÑÉÕÑÕÉ…±±ä™…±Í”…¹•Ù…±Õ…Ñ”½¹±äÑ…É•Ðµ•…ÍÕÉ•µ•¹ÑÌ¸ˆ°(€€€€€ìÉÕ¹%èÉÕ¸¹ÉÕ¹%ô°(€€€€¤ì(€ô(€¥˜€¡•¹Ù•±½Á”¹µ¥ÍÍ¥½¹ÅÕ¥Ù…±•¹•±…¥µ•€„ôô™…±Í”¤ì(€€€…‘‘¥¹‘¥¹œ (€€€€€™¥¹‘¥¹Ì°(€€€€€€‰µ¥ÍÍ¥½¹}•ÅÕ¥Ù…±•¹•}…ÑÑ•µÁÑ•ˆ°(€€€€€€‰Q¡”•á•ÕÑ¥½¸•¹Ù•±½Á”…ÑÑ•µÁÑÌÑ¼±…¥´µ¥ÍÍ¥½¸•ÅÕ¥Ù…±•¹”™É½´½¹”ÉÕ¸¸ˆ°(€€€€€€‰-••Àµ¥ÍÍ¥½¸•ÅÕ¥Ù…±•¹”ÍÑÉÕÑÕÉ…±±ä™…±Í”Õ¹Ñ¥°Ñ…É•Ð•Ù…±Õ…Ñ¥½¸…¹½µÁ…É¥Í½¸…Ñ•ÌÁ…ÍÌ¸ˆ°(€€€€€ìÉÕ¹%èÉÕ¸¹ÉÕ¹%ô°(€€€€¤ì(€ô((€½¹ÍÐ‰±½­¥¹MÑ…Ñ•Ì€ô¹•ÜM•Ðñ½µµ½¹ÍM••‘•‘Q•ÍÑIÕ¹¥¹‘¥¹l‰ÍÑ…Ñ”‰tø¡l(€€€€‰Í••‘•‘}ÁÉ•™±¥¡Ñ}É•ÍÕ±Ñ}µ¥Íµ…Ñ ˆ°(€€€€‰Í••‘•‘}ÁÉ•™±¥¡Ñ}¹½Ñ}…‘µ¥ÑÑ•ˆ°(€€€€‰•á•ÕÑ¥½¹}•¹Ù•±½Á•}‘¥•ÍÑ}µ¥Íµ…Ñ ˆ°(€€€€‰Ñ•ÍÑ}ÉÕ¹}É•ÍÕ±Ñ}‘¥•ÍÑ}µ¥Íµ…Ñ ˆ°(€€€€‰Ñ•ÍÑ}ÉÕ¹}…Í•}µ¥Íµ…Ñ ˆ°(€€€€‰Ñ•ÍÑ}ÉÕ¹}ÕÁÍÑÉ•…µ}‘¥•ÍÑ}µ¥Íµ…Ñ ˆ°(€€€€‰ÉÕ¹}É•Í•ÉÙ…Ñ¥½¹}µ¥ÍÍ¥¹œˆ°(€€€€‰ÉÕ¹}É•Í•ÉÙ…Ñ¥½¹}Í•¹…É¥½}µ¥Íµ…Ñ ˆ°(€€€€‰ÅÕ…±¥™¥…Ñ¥½¹}ÑÉ…¹Í™•É}…ÑÑ•µÁÑ•ˆ°(€€€€‰µ¥ÍÍ¥½¹}•ÅÕ¥Ù…±•¹•}…ÑÑ•µÁÑ•ˆ°(€t¤ì(€½¹ÍÐÍÑ…Ñ”€ô™¥¹‘¥¹Ì¹Í½µ” ¡¥Ñ•´¤€ôø‰±½­¥¹MÑ…Ñ•Ì¹¡…Ì¡¥Ñ•´¹ÍÑ…Ñ”¤¤(€€€€ü€‰Í••‘•‘}Ñ•ÍÑ}ÉÕ¹}‰±½­•ˆ(€€€€è™¥¹‘¥¹Ì¹±•¹Ñ €ø€À(€€€€€€ü€‰Í••‘•‘}Ñ•ÍÑ}ÉÕ¹}¥¹½µÁ±•Ñ”ˆ(€€€€€€è€‰Í••‘•‘}Ñ•ÍÑ}ÉÕ¹}…‘µ¥ÑÑ•ˆì((€É•ÑÕÉ¸ì(€€€Á…ÍÍ•èÍÑ…Ñ”€ôôô€‰Í••‘•‘}Ñ•ÍÑ}ÉÕ¹}…‘µ¥ÑÑ•ˆ°(€€€ÍÑ…Ñ”°(€€€Í••‘•‘AÉ•™±¥¡ÑI•ÍÕ±ÐèÁÉ•™±¥¡ÑI•ÍÕ±Ð°(€€€Í••‘•‘AÉ•™±¥¡ÑI•ÍÕ±Ñ¥•ÍÐèÁÉ•™±¥¡ÑI•ÍÕ±Ñ¥•ÍÐ°(€€€ÁÉ•™±¥¡ÑI••¥ÁÑ¥•ÍÐèÁÉ•™±¥¡ÑI••¥ÁÐ¹É••¥ÁÑ¥•ÍÐ°(€€€•á•ÕÑ¥½¹¹Ù•±½Á•¥•ÍÐè•¹Ù•±½Á•¥•ÍÐ°(€€€Ñ•ÍÑIÕ¹I•ÍÕ±Ñ¥•ÍÐèÉ•ÍÕ±Ñ¥•ÍÐ°(€€€ÉÕ¹%èÉÕ¸¹ÉÕ¹%°(€€€Í•¹…É¥½%èÉÕ¸¹Í•¹…É¥½%°(€€€Ñ•ÍÑIÕ¹MÑ…Ñ”èÉÕ¸¹ÍÑ…Ñ”°(€€€Ñ¡É•Í¡½±‘MÕµµ…ÉäèÑ¡É•Í¡½±‘MÕµµ…Éä¡ÉÕ¸¤°(€€€™¥¹‘¥¹Ì°(€€€Ù…±¥‘…Ñ¥½¹ÉÉ½ÉÌèmt°(€€€Ñ•ÍÑIÕ¹I••¥ÁÐèÉÕ¸°(€€€•á•ÕÑ¥½¹¹Ù•±½Á”è•¹Ù•±½Á”°(€€€ÁÕ±±1¥ÍÐè‘•‘ÕÁ”¡™¥¹‘¥¹Ì¹µ…À ¡¥Ñ•´¤€ôø¥Ñ•´¹É•ÅÕ¥É•‘Ñ¥½¸¤¤°(€€€ÁÉ½¡¥‰¥Ñ•‘QÉ…¹Í¥Ñ¥½¹Ìèl¸¸¹=55=9M}M}QMQ}IU9}AI=!%	%Q}QI9M%Q%=9Mt°(€ôì)ô(