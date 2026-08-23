import type {
  CommonsSeededSubstitutionRequest,
  CommonsSeededSubstitutionResult,
} from "../../types/garpaCommonsSeededSubstitution";

function bullets(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

export function renderCommonsSeededSubstitutionMarkdown(
  request: CommonsSeededSubstitutionRequest,
  result: CommonsSeededSubstitutionResult,
): string {
  return [
    "# GARPA Commons-Seeded Substitution",
    "",
    "## Target",
    `- Case: ${request.plan.caseId}`,
    `- Capability graph: ${request.plan.capabilityGraphDigest}`,
    `- Projection result: ${result.projectionResultDigest || "unresolved"}`,
    `- State: ${result.state}`,
    `- Existing substitution gate: ${result.substitutionGate?.state ?? "not run"}`,
    "",
    "## Seeded components",
    ...bullets(result.seededComponentIds),
    "",
    "## Target-only components",
    ...bullets(result.targetOnlyComponentIds),
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
      ? "Does every admitted substitution option and compatibility edge remain supported by target-case evidence after the Commons-seeded component is removed from consideration?"
      : "Which target-only evidence, compatibility edge, option, or cost boundary still prevents the seeded plan from reaching the existing substitution gate?",
    "",
  ].join("\n");
}
