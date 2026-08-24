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
  return [
    "# GARPA Commons-Seeded Mission Evaluation",
    "",
    "## State",
    `- Case: ${request.evaluationEnvelope.caseId}`,
    `- Evaluation: ${request.evaluationEnvelope.evaluationId}`,
    `- Gate state: ${result.state}`,
    `- Evaluation admitted: ${result.passed}`,
    `- Mission state: ${result.missionState ?? "unresolved"}`,
    `- Qualification transferred: ${request.evaluationEnvelope.qualificationTransferred}`,
    `- Mission equivalence claimed: ${request.evaluationEnvelope.missionEquivalenceClaimed}`,
    "",
    "## Run custody",
    `- Submitted runs: ${request.testRunRequests.length}`,
    `- Admitted run receipts: ${result.admittedRunIds.length}`,
    `- Valid runs: ${result.validRunIds.length}`,
    `- Aborted runs: ${result.abortedRunIds.length}`,
    `- Invalidated runs: ${result.invalidatedRunIds.length}`,
    `- Incomplete runs: ${result.incompleteRunIds.length}`,
    "",
    "## Failed metrics",
    ...bullets(result.failedMetricIds),
    "",
    "## Digests",
    `- Evaluation envelope: ${result.evaluationEnvelopeDigest}`,
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
