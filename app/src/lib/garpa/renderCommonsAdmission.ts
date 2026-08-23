import type {
  CommonsAdmissionRequest,
  CommonsAdmissionResult,
} from "../../types/garpaCommons";

function bullets(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

export function renderCommonsAdmissionMarkdown(
  request: CommonsAdmissionRequest,
  result: CommonsAdmissionResult,
): string {
  return [
    `# GARPA Capability Commons Admission`,
    ``,
    `## Source`,
    `- Case: ${request.sourceCaseId}`,
    `- Release: ${request.sourceReleaseId}`,
    `- Release digest: ${request.sourceReleaseDigest}`,
    `- Verification state: ${request.releaseVerificationState}`,
    ``,
    `## State`,
    `- Admission: ${result.passed ? "admitted" : "blocked or partial"}`,
    `- Admitted primitives: ${result.admittedPrimitiveIds.length}`,
    `- Admitted component observations: ${result.admittedComponentObservationIds.length}`,
    `- Admitted architecture patterns: ${result.admittedArchitecturePatternIds.length}`,
    `- Blocked objects: ${result.blockedObjectIds.length}`,
    ``,
    `## Admitted primitive identities`,
    ...bullets(result.admittedPrimitiveIds),
    ``,
    `## Admitted component observations`,
    ...bullets(result.admittedComponentObservationIds),
    ``,
    `## Admitted architecture patterns`,
    ...bullets(result.admittedArchitecturePatternIds),
    ``,
    `## Blocked objects`,
    ...bullets(result.blockedObjectIds),
    ``,
    `## Findings`,
    ...bullets(
      result.findings.map(
        (finding) =>
          `${finding.objectType}/${finding.objectId} [${finding.state}]: ${finding.reason} Required action: ${finding.requiredAction}`,
      ),
    ),
    ``,
    `## Reuse boundary`,
    `- Commons admission preserves the exact source case, release, fixture, environment, execution class, metrics, residuals, and falsification conditions.`,
    `- Admission does not establish global component qualification, universal substitution, or unrestricted mission equivalence.`,
    `- Superseded and withdrawn releases remain historical records but cannot seed the current commons.`,
    ``,
    `## Control question`,
    result.passed
      ? "Can a future case reuse this object while retaining the exact fixture, version, evidence state, residual, and requalification boundary that earned it?"
      : "Which blocked object can be repaired without upgrading its maturity, component state, or reuse scope beyond the source release?",
    ``,
  ].join("\n");
}
