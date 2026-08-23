import type {
  ClaimPacket,
  GarpaAdmissionResult,
  MissionOutcome,
  ScopedOfferingClaim,
} from "../../types/garpa";

function activeClaims(packet: ClaimPacket, field: string): ScopedOfferingClaim[] {
  return packet.claims.filter(
    (claim) => claim.field === field && claim.lifecycle !== "withdrawn",
  );
}

function statements(packet: ClaimPacket, field: string): string[] {
  return activeClaims(packet, field).map((claim) => claim.statement);
}

function bulletLines(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None admitted."];
}

function valueOrUnresolved(value: string | undefined): string {
  return value?.trim() || "Unresolved";
}

function label(field: string): string {
  const labels: Record<string, string> = {
    offering_identity: "Offering identity",
    offering_version: "Exact offering version",
    advertised_outcome: "Advertised outcome",
    operating_environment: "Operating environment",
    system_boundary: "Complete system boundary",
    operator: "Customer or operator",
    protected_or_affected_object: "Protected or affected object",
    problem_or_threat: "Problem or threat",
    desired_state_change: "Desired state change",
    time_and_coverage_requirement: "Time and coverage requirement",
    success_metrics: "Falsifiable success metrics",
    metric_baseline: "Metric baseline",
    economic_baseline: "Economic baseline",
    measured_performance: "Measured performance",
    deployment_record: "Deployment record",
    independent_verification: "Independent verification",
  };
  return labels[field] ?? field.replace(/_/g, " ");
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim())));
}

function controlQuestion(
  packet: ClaimPacket,
  admission: GarpaAdmissionResult,
): string {
  const offering = packet.subject.offering;
  if (!admission.offeringGate.passed) {
    return `What exact ${offering} version, operating boundary, and externally attributable record would make the advertised outcome specific enough to test?`;
  }
  if (!admission.goalGate.passed) {
    return `What falsifiable metric and baseline would establish that ${offering} achieved the customer outcome rather than merely implementing the advertised mechanism?`;
  }
  return `Which implementation-neutral function should be tested first because failure there would invalidate the cheapest proposed replication of ${offering}?`;
}

export function renderGarpaRealityBrief(
  packet: ClaimPacket,
  outcome: MissionOutcome,
  admission: GarpaAdmissionResult,
): string {
  const subject = packet.subject;
  const advertised = statements(packet, "advertised_outcome");
  const mechanism = statements(packet, "claimed_mechanism");

  const established = admission.offeringGate.admittedFields.flatMap((field) => {
    const fieldStatements = statements(packet, field);
    if (fieldStatements.length > 0) return fieldStatements;
    if (field === "offering_version" && subject.offeringVersion) {
      return [`The evaluated offering version is ${subject.offeringVersion}.`];
    }
    return [];
  });

  const claimedOnly = admission.offeringGate.claimedOnlyFields.flatMap((field) => {
    const fieldStatements = statements(packet, field);
    return fieldStatements.length > 0
      ? fieldStatements.map((statement) => `${statement} [claim only]`)
      : [`${label(field)} remains claim-only.`];
  });

  const unknownFields = dedupe([
    ...admission.offeringGate.missingFields,
    ...admission.goalGate.missingFields,
  ]).map(label);

  const pulls = dedupe([
    ...admission.offeringGate.pullList,
    ...admission.goalGate.pullList,
  ]);

  return [
    `# GARPA Reality Brief — ${subject.offering}`,
    ``,
    `## Object`,
    `- Claimant: ${subject.claimant}`,
    `- Organization: ${subject.organization ?? "Unresolved"}`,
    `- Offering: ${subject.offering}`,
    `- Version: ${subject.offeringVersion ?? "Unresolved"}`,
    `- Offering type: ${subject.offeringType}`,
    `- Source artifacts: ${packet.artifacts.length}`,
    ``,
    `## What is being sold`,
    ...bulletLines(advertised),
    ...(mechanism.length > 0 ? ["", "Claimed mechanism:", ...bulletLines(mechanism)] : []),
    ``,
    `## What the customer appears to be buying`,
    `- Operator: ${valueOrUnresolved(outcome.operator.value)} [${outcome.operator.basis}]`,
    `- Protected or affected object: ${valueOrUnresolved(outcome.protectedOrAffectedObject.value)} [${outcome.protectedOrAffectedObject.basis}]`,
    `- Problem or threat: ${valueOrUnresolved(outcome.problemOrThreat.value)} [${outcome.problemOrThreat.basis}]`,
    `- Desired state change: ${valueOrUnresolved(outcome.desiredStateChange.value)} [${outcome.desiredStateChange.basis}]`,
    `- Operating environment: ${valueOrUnresolved(outcome.operatingEnvironment.value)} [${outcome.operatingEnvironment.basis}]`,
    `- Time and coverage: ${valueOrUnresolved(outcome.timeAndCoverageRequirement.value)} [${outcome.timeAndCoverageRequirement.basis}]`,
    ``,
    `## What is established`,
    ...bulletLines(dedupe(established)),
    ``,
    `## What is merely claimed`,
    ...bulletLines(dedupe(claimedOnly)),
    ``,
    `## What remains unknown`,
    ...bulletLines(unknownFields),
    ``,
    `## Current state`,
    `- Admission: ${admission.state}`,
    `- Offering gate: ${admission.offeringGate.state}`,
    `- Goal gate: ${admission.goalGate.state}`,
    `- Architecture: not generated by the admission layer`,
    `- Capability equivalence: not assessed`,
    ``,
    `## Next evidence pulls`,
    ...bulletLines(pulls),
    ``,
    `## Control question`,
    controlQuestion(packet, admission),
    ``,
  ].join("\n");
}
