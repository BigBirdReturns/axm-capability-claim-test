import type {
  CommonsSeededArchitectureRequest,
  CommonsSeededArchitectureResult,
} from "../../types/garpaCommonsSeededArchitecture";

function bullets(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

export function renderCommonsSeededArchitectureMarkdown(
  request: CommonsSeededArchitectureRequest,
  result: CommonsSeededArchitectureResult,
): string {
  return [
    "# GARPA Commons-Seeded Architecture",
    "",
    "## Target",
    `- Case: ${request.architecture.caseId}`,
    `- Substitution-plan digest: ${result.substitutionPlanDigest || "unresolved"}`,
    `- Seeded-substitution result: ${result.seededSubstitutionResultDigest || "unresolved"}`,
    `- State: ${result.state}`,
    `- Existing architecture gate: ${result.architectureGate?.state ?? "not run"}`,
    "",
    "## Seeded component custody",
    ...bullets(
      result.seededComponentIds.map((id) =>
        result.selectedSeededComponentIds.includes(id)
          ? `${id}: selected with exact target custody`
          : `${id}: missing`,
      ),
    ),
    "",
    "## Findings",
    ...bullets(
      result.findings.map(
        (finding) =>
          `${finding.componentId ?? "request"} [${finding.state}]: ${finding.reason} Required action: ${finding.requiredAction}`,
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
      ? "Can the architecture now define a frozen qualification contract without changing any selected component, option, interface, risk, residual, cost, or schedule boundary?"
      : "Which seed-custody or existing architecture-gate finding still prevents qualification planning?",
    "",
  ].join("\n");
}
