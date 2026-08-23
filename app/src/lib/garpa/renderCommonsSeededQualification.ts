import type {
  CommonsSeededQualificationRequest,
  CommonsSeededQualificationResult,
} from "../../types/garpaCommonsSeededQualification";

function bullets(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

export function renderCommonsSeededQualificationMarkdown(
  request: CommonsSeededQualificationRequest,
  result: CommonsSeededQualificationResult,
): string {
  return [
    "# GARPA Commons-Seeded Qualification",
    "",
    "## Target",
    `- Case: ${request.qualificationContract.caseId}`,
    `- Mission outcome: ${result.missionOutcomeDigest || "unresolved"}`,
    `- Candidate architecture: ${result.candidateArchitectureDigest || "unresolved"}`,
    `- Seeded architecture result: ${result.seededArchitectureResultDigest || "unresolved"}`,
    `- State: ${result.state}`,
    `- Existing qualification gate: ${result.qualificationGate?.state ?? "not run"}`,
    "",
    "## Seeded component qualification bindings",
    ...bullets(
      result.seededComponentIds.map((id) =>
        result.boundSeededComponentIds.includes(id)
          ? `${id}: source and target qualification custody bound`
          : `${id}: missing`,
      ),
    ),
    "",
    "## Findings",
    ...bullets(
      result.findings.map(
        (finding) =>
          `${finding.bindingId ?? finding.componentId ?? "request"} [${finding.state}]: ${finding.reason} Required action: ${finding.requiredAction}`,
      ),
    ),
    "",
    "## Remaining pull list",
    ...bullets(result.pullList),
    "",
    "## Prohibited transitions",
    ...bullets(result.prohibitedTransitions),
    "",
    "## Control question",
    result.passed
      ? "Can a target build manifest now bind every selected component, configuration, instrument, scenario, and authorization without changing the frozen qualification contract?"
      : "Which source-bound requalification requirement or existing qualification-gate finding still prevents a frozen build-manifest boundary?",
    "",
  ].join("\n");
}
