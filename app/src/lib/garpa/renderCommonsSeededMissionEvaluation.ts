import type {
  CommonsSeededMissionEvaluationRequest,
  CommonsSeededMissionEvaluationResult,
} from "../../types/garpaCommonsSeededMissionEvaluation";

function bullets(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

export function renderCommonsSeededMissionEvaluationMarkdown(
  request: CommonsSeededMissionEvaluationRequest,
  result: CommonsSeededMissionEvaluationResult,
): string {
  const scenarioCoverage = result.scenarioCoverage.map(
    (coverage) =>
      `${coverage.scenarioId}: ${coverage.state}; ${coverage.validRunIds.length}/${coverage.requiredValidRuns} valid runs; ${coverage.submittedRunIds.length} submitted.`,
  );
  const metricCoverage = result.metricCoverage.map(
    (coverage) =>
      `${coverage.metricId} (${coverage.criticality}): ${coverage.state}; ${coverage.validRunIds.length}/${coverage.requiredValidRuns} measured runs; minimum ${coverage.minimumSamplesPerRun} samples per run; ${coverage.totalValidSamples} valid samples; pass ${coverage.passRunIds.length}; fail ${coverage.failRunIds.length}; inconclusive ${coverage.inconclusiveRunIds.length}; not measured ${coverage.notMeasuredRunIds.length}.`,
  );
  const excludedRuns = result.runDispositions
    .filter((disposition) => disposition.excluded)
    .map(
      (disposition) =>
        `${disposition.runId} (${disposition.receiptState}): ${
          disposition.exclusionReasons.join("; ") || "excluded by custody state"
        }`,
    );

  return [
    "# GARPA Commons-Seeded Mission Evaluation",
    "",
    "## State",
    `- Case: ${request.evaluationEnvelope.caseId}`,
    `- Evaluation: ${request.evaluationEnvelope.evaluationId}`,
    `- Gate state: ${result.state}`,
    `- Evaluation admitted: ${result.passed}`,
    `- Mission state: ${result.missionState ?? "unresolved"}`,
    `- Full mission boundary: ${request.missionBoundary.fullMissionBoundary}`,
    `- Boundary: ${request.missionBoundary.boundaryDescription}`,
    `- Qualification transferred: ${request.evaluationEnvelope.qualificationTransferred}`,
    `- Mission equivalence claimed: ${request.evaluationEnvelope.missionEquivalenceClaimed}`,
    "",
    "## Run custody",
    `- Submitted runs: ${result.submittedRunIds.length}`,
    `- Retained execution receipts: ${result.retainedRunIds.length}`,
    `- Delegated receipts: ${result.delegatedRunIds.length}`,
    `- Valid runs: ${result.validRunIds.length}`,
    `- Excluded runs: ${result.excludedRunIds.length}`,
    `- Aborted runs: ${result.abortedRunIds.length}`,
    `- Invalidated runs: ${result.invalidatedRunIds.length}`,
    `- Incomplete runs: ${result.incompleteRunIds.length}`,
    "",
    "## Scenario coverage",
    ...bullets(scenarioCoverage),
    "",
    "## Metric coverage",
    ...bullets(metricCoverage),
    "",
    "## Failed metrics",
    ...bullets(result.failedMetricIds),
    "",
    "## Excluded execution receipts",
    ...bullets(excludedRuns),
    "",
    "## Digests",
    `- Evaluation envelope: ${result.evaluationEnvelopeDigest}`,
    `- Campaign preflight receipt: ${result.campaignPreflightReceiptDigest}`,
    `- Complete run set: ${result.runSetDigest}`,
    `- Custodied mission evaluation: ${result.custodiedMissionEvaluationResultDigest}`,
    "",
    "## Findings",
    ...bullets(
      result.findings.map(
        (finding) => `${finding.state}: ${finding.reason}`,
      ),
    ),
    "",
    "## Required actions",
    ...bullets(result.pullList),
    "",
    "## Boundary",
    ...bullets(result.prohibitedTransitions),
    "",
  ].join("\n");
}
