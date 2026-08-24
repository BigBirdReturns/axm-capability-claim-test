import type { CommonsSeededVendorParityRequest } from "../../types/garpaCommonsSeededVendorParity";
import type { CommonsSeededVendorParityResult } from "../../types/garpaCommonsSeededVendorParity";

function bullets(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

export function renderCommonsSeededVendorParityMarkdown(
  request: CommonsSeededVendorParityRequest,
  result: CommonsSeededVendorParityResult,
): string {
  return [
    "# GARPA Commons-Seeded Vendor Parity",
    "",
    "## State",
    `- Case: ${request.parityEnvelope.caseId}`,
    `- Parity record: ${request.parityEnvelope.parityId}`,
    `- Gate state: ${result.state}`,
    `- Custody admitted: ${result.passed}`,
    `- Substantive parity state: ${result.parityState ?? "unresolved"}`,
    `- Vendor: ${request.vendorParityRequest.vendorOffering}`,
    `- Vendor version: ${request.vendorParityRequest.vendorVersion ?? "unresolved"}`,
    "",
    "## Observation custody",
    `- Derived GARPA observations: ${result.derivedGarpaObservations.length}`,
    `- Vendor observations: ${result.vendorObservations.length}`,
    `- Vendor artifacts: ${result.vendorArtifactIds.length}`,
    `- GARPA observation-set digest: ${result.garpaObservationSetDigest}`,
    `- Vendor observation-set digest: ${result.vendorObservationSetDigest}`,
    "",
    "## Metric results",
    ...bullets(
      result.vendorParityEvaluation?.metricResults.map(
        (metric) => `${metric.metricId}: ${metric.state}. ${metric.reason}`,
      ) ?? [],
    ),
    "",
    "## Supported bounded claims",
    ...bullets(result.vendorParityEvaluation?.supportedParityClaims ?? []),
    "",
    "## Unsupported claims and residuals",
    ...bullets(result.vendorParityEvaluation?.unsupportedParityClaims ?? []),
    "",
    "## Findings",
    ...bullets(
      result.findings.map((finding) => `${finding.state}: ${finding.reason}`),
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
