import type {
  CommonsSeededReleaseRequest,
  CommonsSeededReleaseResult,
} from "../../types/garpaCommonsSeededRelease";

function bullets(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

export function renderCommonsSeededReleaseMarkdown(
  request: CommonsSeededReleaseRequest,
  result: CommonsSeededReleaseResult,
): string {
  return [
    "# GARPA Commons-Seeded Release Verification",
    "",
    "## State",
    `- Case: ${request.releaseManifest.caseId}`,
    `- Release: ${request.releaseManifest.releaseId}`,
    `- Gate state: ${result.state}`,
    `- Release record admitted: ${result.passed}`,
    `- Bundle verified: ${result.releaseVerified}`,
    `- Ordinary release state: ${result.releaseState ?? "unresolved"}`,
    `- Public release occurred: ${request.releaseEnvelope.publicReleaseOccurred}`,
    `- Registry updated: ${request.releaseEnvelope.registryUpdated}`,
    "",
    "## Bundle custody",
    `- Required files: ${result.expectedFiles.length}`,
    `- Submitted files: ${request.releaseFiles.length}`,
    `- Manifest digest: ${result.releaseManifestDigest}`,
    `- File-set digest: ${result.fileSetDigest}`,
    `- Bundle digest: ${result.bundleDigest}`,
    "",
    "## Files",
    ...bullets(
      request.releaseFiles.map(
        (file) => `${file.path}: ${file.sha256} (${file.byteLength} bytes)`,
      ),
    ),
    "",
    "## Findings",
    ...bullets(
      result.findings.map(
        (finding) =>
          `${finding.state}${finding.path ? ` [${finding.path}]` : ""}: ${finding.reason}`,
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
