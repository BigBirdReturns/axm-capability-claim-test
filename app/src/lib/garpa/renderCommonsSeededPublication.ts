import type {
  CommonsSeededPublicationRequest,
  CommonsSeededPublicationResult,
} from "../../types/garpaCommonsSeededPublication";

function bullets(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

export function renderCommonsSeededPublicationMarkdown(
  request: CommonsSeededPublicationRequest,
  result: CommonsSeededPublicationResult,
): string {
  return [
    "# GARPA Commons-Seeded Publication Custody",
    "",
    "## State",
    `- Case: ${request.publicationPackage.caseId}`,
    `- Publication candidate: ${request.publicationEnvelope.publicationId}`,
    `- Custody gate state: ${result.state}`,
    `- Publication record admitted: ${result.passed}`,
    `- Ordinary publication state: ${result.publicationState ?? "unresolved"}`,
    `- Publication ready: ${result.publicationReady}`,
    `- Audience: ${request.publicationPackage.audience}`,
    "",
    "## Claim custody",
    `- Required claims: ${result.expectedClaims.length}`,
    `- Submitted claims: ${request.publicationPackage.claims.length}`,
    `- Claim-set digest: ${result.claimSetDigest}`,
    `- Package digest: ${result.publicationPackageDigest}`,
    "",
    "## Claims",
    ...bullets(
      request.publicationPackage.claims.map(
        (claim) => `${claim.id} [${claim.claimClass}]: ${claim.text}`,
      ),
    ),
    "",
    "## Ordinary publication findings",
    ...bullets(
      result.ordinaryPublicationGate?.findings.map(
        (finding) =>
          `${finding.state}${finding.claimId ? ` [${finding.claimId}]` : ""}: ${finding.reason}`,
      ) ?? [],
    ),
    "",
    "## Commons custody findings",
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
