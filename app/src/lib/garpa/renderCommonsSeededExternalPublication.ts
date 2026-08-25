import type {
  CommonsSeededExternalPublicationRequest,
  CommonsSeededExternalPublicationResult,
} from "../../types/garpaCommonsSeededExternalPublication";

function bullets(values: string[], empty: string): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : [`- ${empty}`];
}

export function renderCommonsSeededExternalPublicationMarkdown(
  request: CommonsSeededExternalPublicationRequest,
  result: CommonsSeededExternalPublicationResult,
): string {
  const receipt = request.externalPublicationRequest.receipt;
  const title = result.passed
    ? "# GARPA Commons-Seeded External Publication Receipt"
    : "# GARPA Commons-Seeded External Publication Blocked";

  return [
    title,
    "",
    "## Disposition",
    `- State: ${result.state}`,
    `- Receipt admitted: ${result.receiptAdmitted}`,
    `- Evidence class: ${result.evidenceClass ?? "unresolved"}`,
    `- Event kind: ${result.eventKind ?? "unresolved"}`,
    `- External event observed: ${result.externalEventObserved}`,
    `- Synthetic qualification only: ${result.syntheticQualificationOnly}`,
    `- Public registry published: ${result.publicRegistryPublished}`,
    `- Public release occurred: ${result.publicReleaseOccurred}`,
    "",
    "## Exact event coordinates",
    `- Case: ${receipt.caseId}`,
    `- Release: ${receipt.releaseId}`,
    `- Publisher: ${receipt.publisher}`,
    `- Channel: ${receipt.channel}`,
    `- Locator: ${receipt.sourceLocator}`,
    `- Published at: ${receipt.publishedAt}`,
    `- Observed at: ${receipt.observedAt}`,
    `- Release manifest digest: ${receipt.releaseManifestDigest}`,
    `- Release bundle digest: ${receipt.releaseBundleDigest}`,
    `- Registry entry digest: ${receipt.registryEntryDigest}`,
    `- Target content digest: ${receipt.targetContentDigest}`,
    "",
    "## Capture artifacts",
    ...bullets(
      request.externalPublicationRequest.artifacts.map(
        (artifact) =>
          `${artifact.artifactId} · ${artifact.mediaType} · ${artifact.byteLength} bytes · ${artifact.sha256}`,
      ),
      "No capture artifact supplied.",
    ),
    "",
    "## Findings",
    ...bullets(
      result.findings.map(
        (finding) => `${finding.state}: ${finding.reason}`,
      ),
      "No blocking finding.",
    ),
    "",
    "## Control boundary",
    ...bullets(
      result.prohibitedTransitions,
      "No control boundary supplied.",
    ),
    "",
  ].join("\n");
}
