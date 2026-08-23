import type {
  PublicationClaim,
  PublicationGateResult,
  PublicationPackage,
} from "../../types/garpaPublication";

function bullets(values: string[], empty: string): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : [`- ${empty}`];
}

function claimBlock(claim: PublicationClaim): string[] {
  return [
    `### ${claim.id} · ${claim.claimClass}`,
    ``,
    claim.text,
    ``,
    `Scope:`,
    `- Offering version: ${claim.scope.offeringVersion ?? "Not applicable or unresolved"}`,
    `- Build digest: ${claim.scope.buildDigest ?? "Not applicable"}`,
    `- Scenarios: ${(claim.scope.scenarioIds ?? []).join(", ") || "Not applicable"}`,
    `- Metrics: ${(claim.scope.metricIds ?? []).join(", ") || "Not applicable"}`,
    `- Environment: ${claim.scope.environment ?? "See governing evaluation"}`,
    `- Evaluation period: ${claim.scope.evaluationPeriod ?? "Not applicable"}`,
    ``,
    `Support:`,
    ...bullets(
      claim.supportRefs.map((support) => {
        const coordinate =
          support.runReceiptId ??
          support.evaluationDigest ??
          support.stageReceiptId ??
          support.evidenceCellId ??
          support.artifactId ??
          support.costLineIds?.join(", ") ??
          "unresolved";
        return `${support.relation}: ${coordinate}. ${support.note}`;
      }),
      "No support coordinate.",
    ),
    ``,
    `Limitations:`,
    ...bullets(claim.limitations, "None recorded."),
    ``,
    `Prohibited generalizations:`,
    ...bullets(claim.prohibitedGeneralizations, "None recorded."),
    ``,
  ];
}

export function renderPublicDossier(
  pkg: PublicationPackage,
  gate: PublicationGateResult,
): string {
  if (!gate.passed) {
    return [
      `# GARPA Publication Blocked — ${pkg.caseId}`,
      ``,
      `- Gate state: ${gate.state}`,
      `- Admitted claims: ${gate.admittedClaimIds.length}`,
      `- Blocked claims: ${gate.blockedClaimIds.length}`,
      ``,
      `## Required actions`,
      ...bullets(gate.requiredActions, "No action supplied."),
      ``,
      `## Findings`,
      ...bullets(
        gate.findings.map(
          (finding) =>
            `${finding.state}${finding.claimId ? ` [${finding.claimId}]` : ""}: ${finding.reason}`,
        ),
        "No finding supplied.",
      ),
      ``,
    ].join("\n");
  }

  const admitted = pkg.claims.filter((claim) =>
    gate.admittedClaimIds.includes(claim.id),
  );
  const upstream = pkg.upstream;
  const claimReportDigest =
    upstream?.claimReportDigest ??
    pkg.upstreamDigests.claimReport ??
    pkg.upstreamDigests.claim_report ??
    pkg.caseIndexDigest;
  const missionEvaluationDigest =
    upstream?.missionEvaluationDigest ??
    pkg.upstreamDigests.missionEvaluation ??
    pkg.upstreamDigests.mission_evaluation;
  const vendorParityDigest =
    upstream?.vendorParityDigest ??
    pkg.upstreamDigests.vendorParity ??
    pkg.upstreamDigests.vendor_parity;

  return [
    `# GARPA Public Dossier — ${pkg.subject}`,
    ``,
    `## Release disposition`,
    `- Case: ${pkg.caseId}`,
    `- Disposition: ${pkg.disposition}`,
    `- Audience: ${pkg.audience}`,
    `- Claim report: ${claimReportDigest}`,
    `- Mission evaluation: ${missionEvaluationDigest ?? "Not available"}`,
    `- Mission state: ${upstream?.missionEvaluationState ?? "Not available"}`,
    `- Vendor parity evaluation: ${vendorParityDigest ?? "Not available"}`,
    `- Vendor parity state: ${upstream?.vendorParityState ?? pkg.vendorParityState}`,
    ``,
    `## Admitted claims`,
    ``,
    ...admitted.flatMap(claimBlock),
    `## Failure and contradiction history`,
    `Disclosed failures:`,
    ...bullets(pkg.disclosedFailureIds ?? [], "None recorded."),
    ``,
    `Disclosed contradictions:`,
    ...bullets(pkg.disclosedContradictionIds ?? [], "None recorded."),
    ``,
    `## Rights and safety`,
    `- Rights review: ${pkg.rightsReview.state}`,
    `- Safety review: ${pkg.safetyReview.state}`,
    `- Redactions: ${pkg.redactions.length}`,
    ``,
    `Artifact release forms:`,
    ...bullets(
      (pkg.artifactReleaseDecisions ?? []).map(
        (decision) =>
          `${decision.artifactId}: ${decision.releaseForm}. ${decision.rationale}`,
      ),
      "No artifacts included.",
    ),
    ``,
    `## Corrections`,
    `Counterevidence and correction requests: ${pkg.correctionContact ?? "No correction contact supplied."}`,
    ``,
    `## Control boundary`,
    `This dossier contains only claims admitted by the publication gate. Blocked, superseded, unsupported, stale, unsafe, or rights-incompatible claims are excluded rather than softened into prose.`,
    ``,
  ].join("\n");
}
