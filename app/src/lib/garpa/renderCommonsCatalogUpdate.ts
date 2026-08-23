import type {
  CommonsCatalogSearchResult,
  CommonsCatalogUpdateRequest,
  CommonsCatalogUpdateResult,
} from "../../types/garpaCommonsCatalog";

function bullets(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

export function renderCommonsCatalogUpdateMarkdown(
  request: CommonsCatalogUpdateRequest,
  result: CommonsCatalogUpdateResult,
): string {
  return [
    `# GARPA Capability Commons Catalog Update`,
    ``,
    `## Catalog`,
    `- Catalog: ${request.currentCatalog.catalogId}`,
    `- Prior revision: ${request.currentCatalog.revision}`,
    `- Prior digest: ${request.currentCatalog.catalogDigest}`,
    `- Source case: ${request.admissionRequest.sourceCaseId}`,
    `- Source release: ${request.admissionRequest.sourceReleaseId}`,
    `- Source release digest: ${request.admissionRequest.sourceReleaseDigest}`,
    `- Actor: ${request.actor}`,
    ``,
    `## Gate`,
    `- State: ${result.gate.state}`,
    `- Passed: ${result.gate.passed}`,
    `- Applied operations: ${result.appliedOperationIds.length}`,
    `- No-op operations: ${result.noopOperationIds.length}`,
    ``,
    `## Applied operation identities`,
    ...bullets(result.appliedOperationIds),
    ``,
    `## Idempotent operation identities`,
    ...bullets(result.noopOperationIds),
    ``,
    `## Findings`,
    ...bullets(
      result.gate.findings.map(
        (finding) =>
          `${finding.operationId ?? "request"} [${finding.state}]: ${finding.reason} Required action: ${finding.requiredAction}`,
      ),
    ),
    ``,
    `## Result`,
    result.catalog
      ? `- Resulting revision: ${result.catalog.revision}`
      : `- Resulting revision: not issued`,
    result.catalog
      ? `- Resulting digest: ${result.catalog.catalogDigest}`
      : `- Resulting digest: not issued`,
    ``,
    `## Catalog law`,
    `- An existing revision is never overwritten. Changed content creates a new revision and marks the prior current revision superseded.`,
    `- A no-op is admitted only when the incoming canonical object digest exactly matches the current revision.`,
    `- Stable-identity collisions and stale current-revision pointers block the update.`,
    `- Catalog presence does not upgrade maturity, component evidence state, mission scope, or release currency.`,
    ``,
    `## Control question`,
    result.gate.passed
      ? "Can a future search recover both the current reusable object and every superseded revision with its exact source release, fixture, residual, and falsification boundary?"
      : "Which failed identity, digest, coverage, or supersession condition must be repaired without rewriting the current catalog history?",
    ``,
  ].join("\n");
}

export function renderCommonsSearchMarkdown(
  result: CommonsCatalogSearchResult,
): string {
  return [
    `# GARPA Capability Commons Search`,
    ``,
    `- Catalog: ${result.catalogId}`,
    `- Catalog digest: ${result.catalogDigest}`,
    `- Total matches: ${result.totalMatches}`,
    `- Returned: ${result.hits.length}`,
    `- Truncated: ${result.truncated}`,
    ``,
    ...result.hits.flatMap((hit) => [
      `## ${hit.displayName}`,
      `- Type: ${hit.objectType}`,
      `- Catalog object: ${hit.catalogObjectId}`,
      `- Revision: ${hit.revisionId} (${hit.revisionState})`,
      `- Source: ${hit.sourceCaseId} / ${hit.sourceReleaseId}`,
      `- Source release digest: ${hit.sourceReleaseDigest}`,
      `- Maturity or state: ${hit.maturityOrState ?? "not applicable"}`,
      `- Execution class: ${hit.executionClass ?? "not recorded"}`,
      `- Fixture: ${hit.fixture ?? "not applicable"}`,
      `- Matched fields: ${hit.matchedFields.join(", ") || "structured filters"}`,
      `- Residuals: ${hit.residuals.join("; ") || "none recorded"}`,
      `- Falsification conditions: ${hit.falsificationConditions.join("; ") || "not separately recorded"}`,
      ``,
    ]),
    `## Search boundary`,
    `Search returns exact revisions and context. It does not assign a scalar score, erase superseded history, or convert a prior fixture result into qualification for the current case.`,
    ``,
  ].join("\n");
}
