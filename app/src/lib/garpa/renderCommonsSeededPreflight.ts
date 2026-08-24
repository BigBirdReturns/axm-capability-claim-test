import type {
  CommonsSeededPreflightRequest,
  CommonsSeededPreflightResult,
} from "../../types/garpaCommonsSeededPreflight";

function bullets(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

export function renderCommonsSeededPreflightMarkdown(
  request: CommonsSeededPreflightRequest,
  result: CommonsSeededPreflightResult,
): string {
  const receipt = request.preflightReceipt;
  const reservations = receipt.runReservations.map(
    (item) => `${item.runId}: ${item.scenarioId}; reserved ${item.reservedAt}`,
  );
  const findings = result.findings.map(
    (finding) => `${finding.state}: ${finding.reason}`,
  );
  const ordinaryReasons =
    result.ordinaryPreflightGate?.blockingReasons ?? [];

  return [
    `# GARPA Commons-Seeded Preflight`,
    ``,
    `## State`,
    `- Case: ${receipt.caseId}`,
    `- Receipt: ${receipt.receiptId}`,
    `- Gate state: ${result.state}`,
    `- Admitted for reserved target execution: ${result.passed}`,
    `- Ordinary preflight gate passed: ${result.ordinaryPreflightGate?.passed ?? false}`,
    `- Preflight state: ${receipt.state}`,
    `- Qualification transferred: ${receipt.qualificationTransferred}`,
    `- Mission equivalence claimed: ${receipt.missionEquivalenceClaimed}`,
    ``,
    `## Digest custody`,
    `- Seeded as-built result: ${result.seededBuildReceiptResultDigest}`,
    `- As-built receipt: ${result.asBuiltReceiptDigest}`,
    `- Preflight receipt: ${result.preflightReceiptDigest}`,
    ``,
    `## Ready target`,
    `- Fixtures ready: ${result.readyFixtureIds.length}`,
    `- Instruments ready: ${result.readyInstrumentationIds.length}`,
    `- Human roles ready: ${result.readyHumanRoleIds.length}`,
    `- Authorizations satisfied: ${result.satisfiedAuthorizationIds.length}`,
    `- Clock state: ${receipt.clockCheck.state}`,
    `- Measured clock skew: ${receipt.clockCheck.measuredSkewMs} ms`,
    `- Maximum clock skew: ${receipt.clockCheck.maximumAllowedSkewMs} ms`,
    `- Storage state: ${receipt.storageCheck.state}`,
    `- Abort state: ${receipt.abortCheck.state}`,
    ``,
    `## Reserved runs`,
    ...bullets(reservations),
    ``,
    `## Ordinary preflight findings`,
    ...bullets(ordinaryReasons),
    ``,
    `## Findings`,
    ...bullets(findings),
    ``,
    `## Required actions`,
    ...bullets(result.pullList),
    ``,
    `## Boundary`,
    ...bullets(result.prohibitedTransitions),
    ``,
  ].join("\n");
}
