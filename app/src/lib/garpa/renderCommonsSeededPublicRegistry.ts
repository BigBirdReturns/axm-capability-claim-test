import type {
  CommonsSeededPublicRegistryRequest,
  CommonsSeededPublicRegistryResult,
} from "../../types/garpaCommonsSeededPublicRegistry";
import { renderRegistryUpdateMarkdown } from "./renderRegistryUpdate";

function bullets(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

export function renderCommonsSeededPublicRegistryMarkdown(
  request: CommonsSeededPublicRegistryRequest,
  result: CommonsSeededPublicRegistryResult,
): string {
  return [
    "# GARPA Commons-Seeded Public Registry Admission",
    "",
    "## State",
    `- Case: ${request.registryEnvelope.caseId}`,
    `- Registry receipt: ${request.registryEnvelope.registryReceiptId}`,
    `- Gate state: ${result.state}`,
    `- Registry record admitted: ${result.passed}`,
    `- Registry update applied: ${result.registryUpdateApplied}`,
    `- Ordinary registry state: ${result.registryState ?? "unresolved"}`,
    `- Governing release: ${result.nextEntry?.currentReleaseId ?? "unresolved"}`,
    `- External public registry published: ${request.registryEnvelope.publicRegistryPublished}`,
    `- Public release occurred: ${request.registryEnvelope.publicReleaseOccurred}`,
    "",
    "## Digests",
    `- Release result: ${result.seededReleaseResultDigest}`,
    `- Current entry: ${result.currentEntryDigest}`,
    `- Registry update request: ${result.registryUpdateRequestDigest}`,
    `- Identity patch: ${result.identityPatchDigest}`,
    `- Ordinary gate result: ${result.registryUpdateGateResultDigest}`,
    `- Updated entry: ${result.nextEntryDigest}`,
    `- Release history: ${result.releaseHistoryDigest}`,
    "",
    "## Commons custody findings",
    ...bullets(
      result.findings.map((finding) => `${finding.state}: ${finding.reason}`),
    ),
    "",
    "## Required actions",
    ...bullets(result.pullList),
    "",
    "## Ordinary registry result",
    result.ordinaryRegistryUpdate
      ? renderRegistryUpdateMarkdown(result.ordinaryRegistryUpdate)
      : "No ordinary registry result.",
    "",
    "## Boundary",
    ...bullets(result.prohibitedTransitions),
    "",
  ].join("\n");
}
