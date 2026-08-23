import type {
  CommonsRetrievalExecutionResult,
  CommonsRetrievalPlan,
  CommonsTransferRequest,
  CommonsTransferResult,
} from "../../types/garpaCommonsTransfer";

function bullets(values: string[], empty = "None."): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : [`- ${empty}`];
}

export function renderCommonsRetrievalPlanMarkdown(
  plan: CommonsRetrievalPlan,
): string {
  return [
    `# GARPA Commons Retrieval Plan — ${plan.caseId}`,
    ``,
    `- Plan: ${plan.planId}`,
    `- Plan digest: ${plan.planDigest}`,
    `- Catalog: ${plan.catalogId}`,
    `- Catalog digest: ${plan.catalogDigest}`,
    `- Capability graph digest: ${plan.capabilityGraphDigest}`,
    `- Graph admission receipt: ${plan.graphAdmissionReceiptId}`,
    ``,
    `## Retrieval tasks`,
    ...plan.tasks.flatMap((task) => [
      `### ${task.taskId}`,
      `- Target: ${task.targetKind} ${task.targetId} — ${task.targetLabel}`,
      `- Terms: ${task.searchTerms.join(", ")}`,
      `- Object classes: ${task.permittedObjectTypes.join(", ")}`,
      `- Queries: ${task.queries.length}`,
      ``,
    ]),
    `## Prohibited transitions`,
    ...bullets(plan.prohibitedTransitions),
    ``,
  ].join("\n");
}

export function renderCommonsRetrievalExecutionMarkdown(
  result: CommonsRetrievalExecutionResult,
): string {
  return [
    `# GARPA Commons Retrieval Execution — ${result.planId}`,
    ``,
    `- Passed: ${result.passed}`,
    `- Plan digest: ${result.planDigest}`,
    `- Catalog digest: ${result.catalogDigest}`,
    `- Candidate hits: ${result.candidateHits.length}`,
    ``,
    `## Errors`,
    ...bullets(result.errors),
    ``,
    `## Hits`,
    ...result.candidateHits.flatMap((hit) => [
      `### ${hit.objectType}/${hit.catalogObjectId}`,
      `- Revision: ${hit.revisionId} (${hit.revisionState})`,
      `- Object digest: ${hit.objectDigest}`,
      `- Source: ${hit.sourceCaseId} / ${hit.sourceReleaseId}`,
      `- Source release digest: ${hit.sourceReleaseDigest}`,
      `- Suggested use: ${hit.suggestedUse}`,
      `- Target functions: ${hit.targetFunctionIds.join(", ") || "None"}`,
      `- Target interfaces: ${hit.targetInterfaceIds.join(", ") || "None"}`,
      `- Retrieval tasks: ${hit.retrievalTaskIds.join(", ")}`,
      ``,
    ]),
    `## Boundary`,
    `Retrieval produces source-bound leads only. It does not admit component evidence, compatibility, function coverage, architecture, qualification, procurement, testing, deployment, or mission equivalence in the target case.`,
    ``,
  ].join("\n");
}

export function renderCommonsTransferMarkdown(
  request: CommonsTransferRequest,
  result: CommonsTransferResult,
): string {
  return [
    `# GARPA Commons Case Transfer — ${request.targetCapabilityGraph.caseId}`,
    ``,
    `## Governing state`,
    `- Transfer: ${result.state}`,
    `- Passed: ${result.passed}`,
    `- Catalog digest: ${request.expectedCatalogDigest}`,
    `- Capability graph digest: ${request.targetCapabilityGraphDigest}`,
    `- Retrieval plan digest: ${request.retrievalPlan.planDigest}`,
    `- Admitted nominations: ${result.admittedNominationIds.length}`,
    `- Candidate inputs: ${result.candidateInputNominationIds.length}`,
    `- Research leads: ${result.researchLeadNominationIds.length}`,
    `- Blocked nominations: ${result.blockedNominationIds.length}`,
    ``,
    `## Admitted nominations`,
    ...result.nominations.flatMap((item) => [
      `### ${item.nominationId} — ${item.disposition}`,
      `- Use: ${item.requestedUse}`,
      `- Source: ${item.source.objectType}/${item.source.catalogObjectId}`,
      `- Revision: ${item.source.revisionId} (${item.source.revisionState})`,
      `- Object digest: ${item.source.objectDigest}`,
      `- Source release: ${item.source.sourceCaseId} / ${item.source.sourceReleaseId}`,
      `- Source release digest: ${item.source.sourceReleaseDigest}`,
      `- Target functions: ${item.targetFunctionIds.join(", ")}`,
      `- Target interfaces: ${item.targetInterfaceIds.join(", ") || "None"}`,
      `- Environment comparison: ${item.environmentComparison}`,
      `- Execution comparison: ${item.executionComparison}`,
      ``,
      `Residuals:`,
      ...bullets(item.source.residuals),
      ``,
      `Limitations:`,
      ...bullets(item.source.limitations),
      ``,
      `Known target mismatches:`,
      ...bullets(item.knownMismatches),
      ``,
      `Required target evidence:`,
      ...bullets(item.requiredEvidencePulls),
      ``,
      `Required target qualification:`,
      ...bullets(item.requiredQualificationTests),
      ``,
    ]),
    `## Blocked nominations`,
    ...bullets(result.blockedNominationIds),
    ``,
    `## Findings`,
    ...bullets(
      result.findings.map(
        (finding) =>
          `${finding.nominationId ?? "request"} [${finding.state}]: ${finding.reason} Required action: ${finding.requiredAction}`,
      ),
    ),
    ``,
    `## Pull list`,
    ...bullets(result.pullList),
    ``,
    `## Prohibited transitions`,
    ...bullets(result.prohibitedTransitions),
    ``,
    `## Control question`,
    `Which target-case evidence and qualification result would be required before any nominated lead could satisfy the existing substitution and architecture gates?`,
    ``,
  ].join("\n");
}
