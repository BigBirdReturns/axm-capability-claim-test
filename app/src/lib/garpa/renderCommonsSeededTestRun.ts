import type {
  CommonsSeededTestRunRequest,
  CommonsSeededTestRunResult,
} from "../../types/garpaCommonsSeededTestRun";

function bullets(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

export function renderCommonsSeededTestRunMarkdown(
  request: CommonsSeededTestRunRequest,
  result: CommonsSeededTestRunResult,
): string {
  const run = request.testRunReceipt;
  const summary = result.thresholdSummary;
  return [
    "# GARPA Commons-Seeded Test Run",
    "",
    "## Receipt state",
    `- Admission state: ${result.state}`,
    `- Receipt admitted: ${result.passed}`,
    `- Recorded execution state: ${run.state}`,
    `- Run: ${run.runId}`,
    `- Scenario: ${run.scenarioId}`,
    "",
    "## Custody",
    `- Preflight result: ${result.seededPreflightResultDigest}`,
    `- Preflight receipt: ${result.preflightReceiptDigest}`,
    `- As-built receipt: ${request.executionEnvelope.asBuiltReceiptDigest}`,
    `- Qualification contract: ${request.executionEnvelope.qualificationContractDigest}`,
    `- Execution envelope: ${result.executionEnvelopeDigest}`,
    `- Test-run receipt: ${result.testRunResultDigest}`,
    "",
    "## Threshold dispositions",
    `- Pass: ${summary.passMetricIds.join(", ") || "none"}`,
    `- Fail: ${summary.failMetricIds.join(", ") || "none"}`,
    `- Inconclusive: ${summary.inconclusiveMetricIds.join(", ") || "none"}`,
    `- Not measured: ${summary.notMeasuredMetricIds.join(", ") || "none"}`,
    "",
    "## Findings",
    ...bullets(result.findings.map((finding) => `${finding.state}: ${finding.reason}`)),
    "",
    "## Required actions",
    ...bullets(result.pullList),
    "",
    "## Boundary",
    ...bullets(result.prohibitedTransitions),
    "",
    "Admission of this receipt proves only that one reserved target execution was coherently recorded. It does not convert a threshold result into mission adequacy, vendor parity, deployment authority, or publication authority.",
    "",
  ].join("\n");
}
