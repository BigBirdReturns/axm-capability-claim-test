import type { MissionEvaluation } from "../../types/garpaExecution";

function bullets(values: string[], empty: string): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : [`- ${empty}`];
}

export function renderMissionEvaluationMarkdown(
  evaluation: MissionEvaluation,
): string {
  return [
    `# GARPA Mission Evaluation — ${evaluation.caseId}`,
    ``,
    `## Disposition`,
    `- Mission adequacy: ${evaluation.state}`,
    `- Qualification contract: ${evaluation.qualificationContractDigest}`,
    `- Evaluated build receipt: ${evaluation.evaluatedBuildReceiptDigest}`,
    ``,
    `## Run custody`,
    `Valid runs:`,
    ...bullets(evaluation.validRunIds, "None."),
    ``,
    `Excluded runs retained in the case record:`,
    ...bullets(evaluation.excludedRunIds, "None."),
    ``,
    `## Coverage gaps`,
    `Missing scenarios:`,
    ...bullets(evaluation.missingScenarioIds, "None."),
    ``,
    `Missing metrics:`,
    ...bullets(evaluation.missingMetricIds, "None."),
    ``,
    `Insufficient repetitions:`,
    ...bullets(evaluation.insufficientRunMetricIds, "None."),
    ``,
    `## Essential metric disposition`,
    `Failed essential metrics:`,
    ...bullets(evaluation.failedEssentialMetricIds, "None."),
    ``,
    `Inconclusive essential metrics:`,
    ...bullets(evaluation.inconclusiveEssentialMetricIds, "None."),
    ``,
    `## Residuals`,
    ...bullets(evaluation.residuals, "No residual recorded."),
    ``,
    `## Falsification line`,
    evaluation.falsificationLine,
    ``,
    `## Control boundary`,
    evaluation.state === "bounded_match"
      ? "This result is confined to the frozen evaluated boundary. It does not establish full-mission or vendor-system equivalence."
      : "The evaluation state is limited to the frozen build, qualification contract, scenarios, metrics, and accepted run receipts.",
    ``,
  ].join("\n");
}
