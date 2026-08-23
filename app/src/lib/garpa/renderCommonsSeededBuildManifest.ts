import type {
  CommonsSeededBuildManifestRequest,
  CommonsSeededBuildManifestResult,
} from "../../types/garpaCommonsSeededBuildManifest";

function bullets(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

export function renderCommonsSeededBuildManifestMarkdown(
  request: CommonsSeededBuildManifestRequest,
  result: CommonsSeededBuildManifestResult,
): string {
  return [
    "# GARPA Commons-Seeded Build Manifest",
    "",
    "## Target",
    `- Case: ${request.buildManifest.caseId}`,
    `- Candidate architecture: ${result.candidateArchitectureDigest || "unresolved"}`,
    `- Qualification contract: ${result.qualificationContractDigest || "unresolved"}`,
    `- Seeded qualification result: ${result.seededQualificationResultDigest || "unresolved"}`,
    `- Build manifest: ${result.buildManifestDigest || "unresolved"}`,
    `- State: ${result.state}`,
    `- Existing build-manifest gate: ${result.buildManifestGate?.state ?? "not run"}`,
    "",
    "## Seeded component build bindings",
    ...bullets(
      result.seededComponentIds.map((id) =>
        result.boundSeededComponentIds.includes(id)
          ? `${id}: source, qualification, configuration, component, policy, calibration, and assembly custody bound`
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
      ? "Can controlled assembly now produce an as-built receipt that proves the exact installed identities, versions, configuration digests, substitutions, calibration artifacts, deviations, and custody chain without treating manifest intent as execution evidence?"
      : "Which seeded-component custody defect or existing build-manifest-gate finding still prevents controlled assembly?",
    "",
  ].join("\n");
}
