import type {
  CommonsSeededExternalDistributionRequest,
  CommonsSeededExternalDistributionResult,
} from "../../types/garpaCommonsSeededExternalDistribution";

function bullets(values: string[]): string[] {
  return values.length > 0
    ? values.map((value) => `- ${value}`)
    : ["- None."];
}

export function renderCommonsSeededExternalDistributionMarkdown(
  request: CommonsSeededExternalDistributionRequest,
  result: CommonsSeededExternalDistributionResult,
): string {
  const observation = request.distributionObservation;
  return [
    "# GARPA Commons-Seeded External Distribution Receipt",
    "",
    "## State",
    `- Case: ${observation.caseId}`,
    `- Distribution receipt: ${request.distributionEnvelope.distributionReceiptId}`,
    `- Mode: ${observation.mode}`,
    `- Event kind: ${observation.eventKind}`,
    `- Channel: ${observation.channel}`,
    `- Gate state: ${result.state}`,
    `- Receipt admitted: ${result.receiptAdmitted}`,
    `- External event observed: ${result.eventObserved}`,
    `- Public release occurred: ${result.publicReleaseOccurred}`,
    `- Public registry published: ${result.publicRegistryPublished}`,
    "",
    "## Governing release",
    `- Release: ${observation.releaseId}`,
    `- Manifest digest: ${observation.releaseManifestDigest}`,
    `- Bundle digest: ${observation.releaseBundleDigest}`,
    `- Registry entry digest: ${observation.registryEntryDigest}`,
    `- Destination: ${observation.destinationUri}`,
    "",
    "## Custody",
    `- Expected files: ${result.expectedFiles.length}`,
    `- Observed files: ${result.observedFiles.length}`,
    `- Evidence artifacts: ${result.evidenceArtifacts.length}`,
    `- Observation digest: ${result.distributionObservationDigest}`,
    `- Observed file-set digest: ${result.observedFileSetDigest}`,
    `- Evidence-artifact set digest: ${result.evidenceArtifactSetDigest}`,
    "",
    "## Evidence artifacts",
    ...bullets(
      result.evidenceArtifacts.map(
        (artifact) =>
          `${artifact.artifactId} · ${artifact.role} · ${artifact.evidenceControl} · ${artifact.sha256}`,
      ),
    ),
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
