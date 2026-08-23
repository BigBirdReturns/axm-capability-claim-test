import type {
  IdentityLineageLink,
  OfferingVersionIdentity,
  PublicCaseRegistryEntry,
  RegistryReleaseRecord,
  RegistryReleaseUpdateRequest,
  RegistryUpdateFinding,
  RegistryUpdateGateResult,
  RegistryUpdateResult,
} from "../../types/garpaRegistry";

function addFinding(
  findings: RegistryUpdateFinding[],
  state: RegistryUpdateFinding["state"],
  reason: string,
  requiredAction: string,
): void {
  findings.push({ state, reason, requiredAction });
}

function expectedNextRelease(entry: PublicCaseRegistryEntry): number {
  return entry.releases.length === 0
    ? 1
    : Math.max(...entry.releases.map((release) => release.releaseNumber)) + 1;
}

function hasIdentityLineage(
  entry: PublicCaseRegistryEntry,
  request: RegistryReleaseUpdateRequest,
): boolean {
  const oldSubjects = new Set(
    [entry.canonicalSubject, entry.offering].filter(
      (value): value is string => Boolean(value?.trim()),
    ),
  );
  const newSubjects = new Set(
    [request.identityPatch.canonicalSubject, request.identityPatch.offering].filter(
      (value): value is string => Boolean(value?.trim()),
    ),
  );

  const changed =
    entry.canonicalSubject !== request.identityPatch.canonicalSubject ||
    (entry.offering ?? "") !== (request.identityPatch.offering ?? "");
  if (!changed) return true;

  return request.identityPatch.lineageLinksAdded.some((link) => {
    const forward = oldSubjects.has(link.fromSubject) && newSubjects.has(link.toSubject);
    const reverse = oldSubjects.has(link.toSubject) && newSubjects.has(link.fromSubject);
    return forward || reverse;
  });
}

const FINDING_PRIORITY: RegistryUpdateFinding["state"][] = [
  "case_mismatch",
  "current_release_conflict",
  "release_not_current_valid",
  "release_number_gap",
  "release_lineage_mismatch",
  "release_identity_reused",
  "identity_lineage_missing",
  "invalid_case_transition",
];

export function runRegistryUpdateGate(
  request: RegistryReleaseUpdateRequest,
): RegistryUpdateGateResult {
  const findings: RegistryUpdateFinding[] = [];
  const entry = request.currentEntry;
  const release = request.candidateRelease;
  const nextReleaseNumber = expectedNextRelease(entry);

  if (release.caseId !== entry.caseId) {
    addFinding(
      findings,
      "case_mismatch",
      `Candidate release case ${release.caseId} does not match registry case ${entry.caseId}.`,
      "Target the correct case entry or create a separately linked case.",
    );
  }

  if (
    request.expectedCurrentReleaseId !== entry.currentReleaseId ||
    request.expectedCurrentReleaseDigest !== entry.currentReleaseDigest
  ) {
    addFinding(
      findings,
      "current_release_conflict",
      "The update was prepared against a different current release pointer than the registry now carries.",
      "Reload the current registry entry and rebuild the update without changing the candidate evidence history.",
    );
  }

  if (
    request.releaseVerificationState !== "current_valid" ||
    release.state !== "current"
  ) {
    addFinding(
      findings,
      "release_not_current_valid",
      `Candidate release verification/state is ${request.releaseVerificationState}/${release.state}.`,
      "Verify a release manifest in current state before applying it as the governing release.",
    );
  }

  if (release.releaseNumber !== nextReleaseNumber) {
    addFinding(
      findings,
      "release_number_gap",
      `Candidate release number ${release.releaseNumber} does not equal next release number ${nextReleaseNumber}.`,
      "Use the next contiguous release number without reusing or skipping history.",
    );
  }

  if (nextReleaseNumber === 1) {
    if (release.priorReleaseDigest || release.supersedesReleaseId) {
      addFinding(
        findings,
        "release_lineage_mismatch",
        "The first release cannot carry prior-release or supersession lineage.",
        "Remove prior-release fields or register the missing predecessor first.",
      );
    }
  } else if (
    release.priorReleaseDigest !== entry.currentReleaseDigest ||
    release.supersedesReleaseId !== entry.currentReleaseId
  ) {
    addFinding(
      findings,
      "release_lineage_mismatch",
      "Candidate release lineage does not point to the current governing release identifier and digest.",
      "Set priorReleaseDigest and supersedesReleaseId to the exact current release before retrying.",
    );
  }

  if (
    entry.releases.some(
      (known) =>
        known.releaseId === release.releaseId ||
        known.manifestDigest === release.manifestDigest,
    )
  ) {
    addFinding(
      findings,
      "release_identity_reused",
      "Candidate release reuses an existing release identifier or manifest digest.",
      "Issue a distinct release identifier and content-addressed manifest.",
    );
  }

  if (!hasIdentityLineage(entry, request)) {
    addFinding(
      findings,
      "identity_lineage_missing",
      "Canonical subject or offering changed without a source-backed identity lineage link.",
      "Add a rebrand, successor, predecessor, acquired-brand, transfer, or same-offering link with evidence artifacts.",
    );
  }

  if (
    request.candidateCaseState !== "publication_ready" ||
    entry.currentState === "withdrawn" ||
    Date.parse(request.updatedAt) < Date.parse(entry.updatedAt)
  ) {
    addFinding(
      findings,
      "invalid_case_transition",
      "A current release update requires publication_ready state, a non-withdrawn case, and a non-regressing update time.",
      "Complete the publication gate or create a separately reviewed reactivation path.",
    );
  }

  const state =
    FINDING_PRIORITY.find((candidate) =>
      findings.some((finding) => finding.state === candidate),
    ) ?? "registry_update_admitted";

  return {
    passed: findings.length === 0,
    state,
    findings,
    nextReleaseNumber,
  };
}

function union(values: string[], added: string[]): string[] {
  return Array.from(new Set([...values, ...added]));
}

function updatedVersions(
  current: OfferingVersionIdentity[],
  added: OfferingVersionIdentity[],
): OfferingVersionIdentity[] {
  if (!added.some((version) => version.state === "current")) {
    return [...current, ...added];
  }
  return [
    ...current.map((version) =>
      version.state === "current"
        ? { ...version, state: "superseded" as const }
        : version,
    ),
    ...added,
  ];
}

function updatedLineage(
  current: IdentityLineageLink[],
  added: IdentityLineageLink[],
): IdentityLineageLink[] {
  return [...current, ...added];
}

function releaseRecord(
  request: RegistryReleaseUpdateRequest,
): RegistryReleaseRecord {
  const release = request.candidateRelease;
  return {
    releaseId: release.releaseId,
    releaseNumber: release.releaseNumber,
    manifestDigest: release.manifestDigest,
    state: "current",
    priorReleaseDigest: release.priorReleaseDigest,
    supersedesReleaseId: release.supersedesReleaseId,
    createdAt: release.createdAt,
  };
}

export function applyRegistryReleaseUpdate(
  request: RegistryReleaseUpdateRequest,
): RegistryUpdateResult {
  const gate = runRegistryUpdateGate(request);
  if (!gate.passed) return { gate };

  const entry = request.currentEntry;
  const oldCanonical = entry.canonicalSubject;
  const canonicalChanged = oldCanonical !== request.identityPatch.canonicalSubject;
  const releases = [
    ...entry.releases.map((release) =>
      release.state === "current"
        ? { ...release, state: "superseded" as const }
        : release,
    ),
    releaseRecord(request),
  ];

  const updated: PublicCaseRegistryEntry = {
    ...entry,
    canonicalSubject: request.identityPatch.canonicalSubject,
    aliases: union(
      entry.aliases,
      [
        ...request.identityPatch.aliasesAdded,
        ...(canonicalChanged ? [oldCanonical] : []),
      ],
    ),
    claimant: request.identityPatch.claimant ?? entry.claimant,
    organization: request.identityPatch.organization ?? entry.organization,
    offering: request.identityPatch.offering ?? entry.offering,
    versions: updatedVersions(entry.versions, request.identityPatch.versionsAdded),
    lineage: updatedLineage(entry.lineage, request.identityPatch.lineageLinksAdded),
    domainTags: union(entry.domainTags, request.identityPatch.domainTagsAdded),
    capabilityTags: union(
      entry.capabilityTags,
      request.identityPatch.capabilityTagsAdded,
    ),
    currentState: request.candidateCaseState,
    currentDisposition:
      request.candidateDisposition ?? entry.currentDisposition,
    releases,
    currentReleaseId: request.candidateRelease.releaseId,
    currentReleaseDigest: request.candidateRelease.manifestDigest,
    updatedAt: request.updatedAt,
  };

  return { gate, entry: updated };
}
