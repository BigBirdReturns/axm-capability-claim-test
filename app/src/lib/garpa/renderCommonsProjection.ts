import type {
  CommonsComponentProjectionRequest,
  CommonsComponentProjectionResult,
} from "../../types/garpaCommonsProjection";

function bullets(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

export function renderCommonsComponentProjectionMarkdown(
  request: CommonsComponentProjectionRequest,
  result: CommonsComponentProjectionResult,
): string {
  const projected = result.projected;
  return [
    "# GARPA Commons Component Projection",
    "",
    "## Target",
    `- Case: ${request.compatibilityAdmissionReceipt.targetCaseId}`,
    `- Mission outcome digest: ${request.compatibilityAdmissionReceipt.targetMissionOutcomeDigest}`,
    `- Capability graph digest: ${request.compatibilityAdmissionReceipt.targetCapabilityGraphDigest}`,
    `- Target component id: ${request.targetComponentId}`,
    "",
    "## Source custody",
    `- Catalog object: ${request.compatibilityAdmissionReceipt.catalogObjectId}`,
    `- Revision: ${request.compatibilityAdmissionReceipt.revisionId}`,
    `- Object digest: ${request.compatibilityAdmissionReceipt.objectDigest}`,
    `- Source case: ${request.compatibilityAdmissionReceipt.sourceCaseId}`,
    `- Source release: ${request.compatibilityAdmissionReceipt.sourceReleaseId}`,
    `- Closure receipt: ${request.compatibilityAdmissionReceipt.receiptDigest}`,
    "",
    "## Gate",
    `- State: ${result.state}`,
    `- Passed: ${result.passed}`,
    `- Readiness: ${result.readiness ?? "blocked"}`,
    "",
    "## Findings",
    ...bullets(
      result.findings.map(
        (finding) => `${finding.state}: ${finding.reason} Required action: ${finding.requiredAction}`,
      ),
    ),
    "",
    "## Withheld source fields",
    ...bullets(projected?.withheldFields ?? []),
    "",
    "## Target evidence pulls",
    ...bullets(projected?.requiredEvidencePulls ?? []),
    "",
    "## Projection boundary",
    ...bullets(projected?.prohibitedTransitions ?? []),
    "",
    "## Control question",
    projected?.readiness === "substitution_ready"
      ? "Will the projected component now survive the existing target substitution gate with no source-case field silently standing in for target evidence?"
      : "Which withheld target field controls whether this exact-version component can advance from candidate projection to substitution readiness?",
    "",
  ].join("\n");
}
