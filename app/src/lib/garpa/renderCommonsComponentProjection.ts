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
  return [
    "# GARPA Commons Component Projection",
    "",
    "## Target",
    `- Case: ${request.transferRequest.targetCapabilityGraph.caseId}`,
    `- Capability graph: ${request.transferRequest.targetCapabilityGraphDigest}`,
    `- Transfer result: ${result.transferResultDigest || "unresolved"}`,
    `- Projection state: ${result.state}`,
    "",
    "## Projected target candidates",
    ...bullets(
      result.projectedComponents.map(
        (item) =>
          `${item.candidate.id}: ${item.candidate.product} ${item.candidate.exactModelOrVersion} from ${item.source.sourceCaseId}/${item.source.sourceReleaseId}`,
      ),
    ),
    "",
    "## Blocked projections",
    ...bullets(result.blockedProjectionIds),
    "",
    "## Seed boundary",
    ...(result.seed
      ? [
          `- Candidate ids: ${result.seed.componentCandidateIds.join(", ") || "none"}`,
          `- Unmapped required functions: ${result.seed.unmappedRequiredFunctionIds.join(", ") || "none"}`,
          `- Unmapped required interfaces: ${result.seed.unmappedRequiredInterfaceIds.join(", ") || "none"}`,
          `- Compatibility still required for: ${result.seed.requiredCompatibilityInterfaceIds.join(", ") || "none"}`,
        ]
      : ["- No substitution seed was admitted."]),
    "",
    "## Findings",
    ...bullets(
      result.findings.map(
        (finding) =>
          `${finding.projectionId ?? "request"} [${finding.state}]: ${finding.reason} Required action: ${finding.requiredAction}`,
      ),
    ),
    "",
    "## Prohibited transitions",
    ...bullets(result.prohibitedTransitions),
    "",
    "## Control question",
    result.passed
      ? "Can the target case now build compatibility edges, substitution options, and a complete cost boundary using only target-case evidence while retaining the exact Commons source boundary?"
      : "Which blocked projection can be repaired without importing source-case evidence as target-case proof?",
    "",
  ].join("\n");
}
