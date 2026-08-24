import type {
  PublicationClaim,
  PublicationGateResult,
} from "../../types/garpaPublication";
import type {
  CommonsSeededPublicationFinding,
  CommonsSeededPublicationRequest,
  CommonsSeededPublicationResult,
} from "../../types/garpaCommonsSeededPublication";
import { canonicalStringify } from "./canonicalJson";
import {
  canonicalPublicationArtifacts,
  canonicalPublicationClaims,
  computeCommonsSeededPublicationArtifactSetDigest,
  computeCommonsSeededPublicationCaseIndexDigest,
  computeCommonsSeededPublicationClaimSetDigest,
  computeCommonsSeededPublicationEnvelopeDigest,
  computeCommonsSeededPublicationPackageDigest,
  computeCommonsSeededPublicationUpstreamDigestSetDigest,
} from "./commonsSeededPublicationDigest";
import {
  collectPublicationArtifactIds,
  deriveCommonsSeededPublicationArtifacts,
  deriveCommonsSeededPublicationClaims,
  deriveCommonsSeededPublicationDisposition,
  deriveCommonsSeededPublicationUpstreamDigests,
} from "./deriveCommonsSeededPublication";
import { computeCommonsSeededVendorParityResultDigest } from "./commonsSeededVendorParityDigest";
import { runCommonsSeededVendorParityGate } from "./runCommonsSeededVendorParityGate";
import { runPublicationGate } from "./runPublicationGate";
import { sha256Hex } from "./sha256";
import { validateCommonsSeededPublicationRequest } from "./validateCommonsSeededPublication";

export const COMMONS_SEEDED_PUBLICATION_PROHIBITED_TRANSITIONS = [
  "Admission of a publication package records exact claim, support, review, redaction, and upstream custody; it does not mean the ordinary publication gate is ready.",
  "A publication-ready package does not establish release integrity, current registry status, deployment authority, or unrestricted product equivalence.",
  "Mission failures, parity misses, missing vendor baselines, evidence-only comparisons, residuals, blocked rights, safety restrictions, and redaction effects remain visible and cannot be omitted or softened into favorable prose.",
] as const;

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function sorted(values: string[]): string[] {
  return dedupe(values).sort((left, right) => left.localeCompare(right));
}

function exactSet(left: string[], right: string[]): boolean {
  const a = sorted(left);
  const b = sorted(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function addFinding(
  findings: CommonsSeededPublicationFinding[],
  state: CommonsSeededPublicationFinding["state"],
  reason: string,
  requiredAction: string,
  coordinates: Partial<CommonsSeededPublicationFinding> = {},
): void {
  findings.push({ state, reason, requiredAction, ...coordinates });
}

function blockedResult(errors: string[]): CommonsSeededPublicationResult {
  return {
    passed: false,
    state: "seeded_publication_blocked",
    publicationReady: false,
    seededVendorParityResultDigest: "",
    publicationPackageDigest: "",
    publicationEnvelopeDigest: "",
    claimSetDigest: "",
    upstreamDigestSetDigest: "",
    artifactSetDigest: "",
    ordinaryPublicationGateResultDigest: "",
    expectedUpstreamDigests: {},
    expectedClaims: [],
    publicationArtifactIds: [],
    findings: errors.map((reason) => ({
      state: "publication_validation_failed" as const,
      reason,
      requiredAction:
        "Repair the Commons-seeded publication request and rerun validation.",
    })),
    validationErrors: errors,
    pullList: errors,
    prohibitedTransitions: [...COMMONS_SEEDED_PUBLICATION_PROHIBITED_TRANSITIONS],
  };
}

function rightsDecisionIds(
  publication: CommonsSeededPublicationRequest["publicationPackage"],
): string[] {
  return (publication.rightsReview.artifactDecisions ?? []).map(
    (decision) => decision.artifactId,
  );
}

function referencedArtifactIds(
  publication: CommonsSeededPublicationRequest["publicationPackage"],
): string[] {
  return collectPublicationArtifactIds(
    publication.claims,
    rightsDecisionIds(publication),
    publication.safetyReview.findings.flatMap(
      (finding) => finding.affectedArtifactIds,
    ),
    publication.redactions.flatMap((redaction) =>
      redaction.artifactId ? [redaction.artifactId] : [],
    ),
  );
}

function sameClaims(left: PublicationClaim[], right: PublicationClaim[]): boolean {
  return (
    canonicalStringify(canonicalPublicationClaims(left)) ===
    canonicalStringify(canonicalPublicationClaims(right))
  );
}

export function runCommonsSeededPublicationGate(
  input: CommonsSeededPublicationRequest | unknown,
): CommonsSeededPublicationResult {
  const validated = validateCommonsSeededPublicationRequest(input);
  if (!validated.ok || !validated.value) return blockedResult(validated.errors);

  const request = validated.value;
  const packageValue = request.publicationPackage;
  const envelope = request.publicationEnvelope;
  const findings: CommonsSeededPublicationFinding[] = [];
  const parityResult = runCommonsSeededVendorParityGate(
    request.seededVendorParityRequest,
  );
  const parityResultDigest =
    computeCommonsSeededVendorParityResultDigest(parityResult);
  const packageDigest =
    computeCommonsSeededPublicationPackageDigest(packageValue);
  const envelopeDigest =
    computeCommonsSeededPublicationEnvelopeDigest(envelope);
  const claimSetDigest =
    computeCommonsSeededPublicationClaimSetDigest(packageValue.claims);
  const upstreamDigestSetDigest =
    computeCommonsSeededPublicationUpstreamDigestSetDigest(
      packageValue.upstreamDigests,
    );
  const artifactSetDigest =
    computeCommonsSeededPublicationArtifactSetDigest(
      envelope.publicationArtifacts,
    );

  if (
    request.expectedSeededVendorParityResultDigest !== parityResultDigest ||
    envelope.seededVendorParityResultDigest !== parityResultDigest
  ) {
    addFinding(
      findings,
      "vendor_parity_result_mismatch",
      "The expected or enveloped Commons-seeded vendor-parity result digest does not match deterministic recomputation.",
      "Refresh the exact admitted vendor-parity result before compiling publication claims.",
    );
  }
  if (!parityResult.passed || !parityResult.seededMissionEvaluationResult) {
    addFinding(
      findings,
      "vendor_parity_not_admitted",
      "The governing Commons-seeded vendor-parity record is not admitted.",
      "Resolve parity custody before publication compilation.",
    );
  }

  const mission = parityResult.seededMissionEvaluationResult;
  const firstRun = request.seededVendorParityRequest
    .seededMissionEvaluationRequest.testRunRequests[0]!;
  const qualification = firstRun.seededPreflightRequest
    .seededBuildReceiptRequest.seededBuildManifestRequest
    .seededQualificationRequest.qualificationContract;
  const asBuilt = firstRun.seededPreflightRequest
    .seededBuildReceiptRequest.asBuiltReceipt;
  const expectedUpstreamDigests = parityResult.passed
    ? deriveCommonsSeededPublicationUpstreamDigests(
        request.seededVendorParityRequest,
        parityResult,
      )
    : {};
  const expectedCaseIndexDigest = computeCommonsSeededPublicationCaseIndexDigest(
    asBuilt.caseId,
    expectedUpstreamDigests,
  );
  const expectedClaims = parityResult.passed
    ? deriveCommonsSeededPublicationClaims(
        request.seededVendorParityRequest,
        parityResult,
        packageValue.subject,
      )
    : [];
  const expectedDisposition = deriveCommonsSeededPublicationDisposition(
    parityResult,
  );
  const expectedArtifacts = deriveCommonsSeededPublicationArtifacts(
    request.seededVendorParityRequest,
  );
  const expectedArtifactIds = expectedArtifacts.map(
    (artifact) => artifact.artifactId,
  );

  if (envelope.publicationPackageDigest !== packageDigest) {
    addFinding(
      findings,
      "publication_package_digest_mismatch",
      "The publication-package digest does not match its canonical content.",
      "Restore the immutable publication package and recompute its digest.",
    );
  }
  if (envelope.envelopeDigest !== envelopeDigest) {
    addFinding(
      findings,
      "publication_envelope_digest_mismatch",
      "The publication-envelope digest does not match its canonical content.",
      "Restore the immutable publication envelope and recompute its digest.",
    );
  }
  if (
    packageValue.caseId !== asBuilt.caseId ||
    envelope.caseId !== asBuilt.caseId
  ) {
    addFinding(
      findings,
      "publication_case_mismatch",
      "The publication package, envelope, and as-built system do not identify the same target case.",
      "Compile publication only for the exact admitted target case.",
    );
  }
  if (
    canonicalStringify(packageValue.upstreamDigests) !==
      canonicalStringify(expectedUpstreamDigests) ||
    envelope.upstreamDigestSetDigest !==
      computeCommonsSeededPublicationUpstreamDigestSetDigest(
        expectedUpstreamDigests,
      ) ||
    envelope.missionOutcomeDigest !== qualification.missionOutcomeDigest ||
    envelope.qualificationContractDigest !== asBuilt.qualificationContractDigest ||
    envelope.asBuiltReceiptDigest !== asBuilt.receiptDigest ||
    envelope.campaignPreflightReceiptDigest !==
      mission?.campaignPreflightReceiptDigest ||
    envelope.runSetDigest !== mission?.runSetDigest ||
    envelope.seededMissionEvaluationResultDigest !==
      parityResult.seededMissionEvaluationResultDigest ||
    envelope.vendorParityEvaluationDigest !==
      parityResult.vendorParityEvaluationDigest
  ) {
    addFinding(
      findings,
      "publication_upstream_digest_mismatch",
      "Publication is not bound to the exact mission outcome, qualification, as-built receipt, campaign, mission evaluation, and vendor-parity result.",
      "Recompile the package from the exact admitted upstream chain.",
    );
  }
  if (
    packageValue.caseIndexDigest !== expectedCaseIndexDigest ||
    envelope.caseIndexDigest !== expectedCaseIndexDigest
  ) {
    addFinding(
      findings,
      "publication_case_index_mismatch",
      "The case-index digest does not represent the exact current upstream receipt set.",
      "Recompute the case index from the admitted case and upstream digests.",
    );
  }
  if (
    !sameClaims(packageValue.claims, expectedClaims) ||
    envelope.claimSetDigest !==
      computeCommonsSeededPublicationClaimSetDigest(expectedClaims)
  ) {
    const expectedById = new Map(expectedClaims.map((claim) => [claim.id, claim]));
    const actualById = new Map(
      packageValue.claims.map((claim) => [claim.id, claim]),
    );
    for (const claimId of sorted([
      ...expectedById.keys(),
      ...actualById.keys(),
    ])) {
      if (
        canonicalStringify(expectedById.get(claimId)) !==
        canonicalStringify(actualById.get(claimId))
      ) {
        addFinding(
          findings,
          "publication_claim_set_mismatch",
          `Publication claim ${claimId} differs from the complete deterministic mission and parity compilation.`,
          "Restore every generated claim, support edge, limitation, scope coordinate, and prohibited generalization.",
          { claimId },
        );
      }
    }
  }
  if (packageValue.vendorParityState !== parityResult.parityState) {
    addFinding(
      findings,
      "publication_vendor_parity_state_mismatch",
      "The publication package changes the admitted vendor-parity state.",
      "Use the exact state returned by the existing vendor-parity evaluator.",
    );
  }
  if (packageValue.disposition !== expectedDisposition) {
    addFinding(
      findings,
      "publication_disposition_mismatch",
      "The publication disposition does not preserve the admitted mission and parity states.",
      "Use the deterministic case disposition for the current evidence state.",
    );
  }

  const rightsTime = Date.parse(packageValue.rightsReview.reviewedAt);
  const safetyTime = Date.parse(packageValue.safetyReview.reviewedAt);
  const preparedTime = Date.parse(packageValue.preparedAt);
  const parityAdmittedTime = Date.parse(
    request.seededVendorParityRequest.admittedAt,
  );
  if (
    preparedTime < parityAdmittedTime ||
    Date.parse(envelope.evaluatedAt) < preparedTime ||
    Date.parse(request.admittedAt) < Date.parse(envelope.evaluatedAt)
  ) {
    addFinding(
      findings,
      "publication_time_order_invalid",
      "Publication preparation predates parity admission, envelope evaluation predates preparation, or request admission predates evaluation.",
      "Restore chronology across parity admission, reviews, preparation, evaluation, and admission.",
    );
  }
  if (rightsTime < parityAdmittedTime || rightsTime > preparedTime) {
    addFinding(
      findings,
      "rights_review_time_order_invalid",
      "The rights review was not completed after parity admission and before publication preparation.",
      "Complete the rights review inside the current publication window.",
    );
  }
  if (safetyTime < parityAdmittedTime || safetyTime > preparedTime) {
    addFinding(
      findings,
      "safety_review_time_order_invalid",
      "The safety review was not completed after parity admission and before publication preparation.",
      "Complete the safety review inside the current publication window.",
    );
  }

  const referencedIds = referencedArtifactIds(packageValue);
  if (!exactSet(referencedIds, expectedArtifactIds)) {
    for (const artifactId of expectedArtifactIds) {
      if (!referencedIds.includes(artifactId)) {
        addFinding(
          findings,
          "publication_artifact_custody_missing",
          `Publication rights and claim custody omit predecessor evidence artifact ${artifactId}.`,
          "Account for every vendor evidence artifact in the publication rights record.",
          { artifactId },
        );
      }
    }
    for (const artifactId of referencedIds) {
      if (!expectedArtifactIds.includes(artifactId)) {
        addFinding(
          findings,
          "publication_artifact_unexpected",
          `Publication references artifact ${artifactId} without admitted vendor-parity custody.`,
          "Remove the ungoverned artifact or admit it through the preceding evidence and parity chain.",
          { artifactId },
        );
      }
    }
  }
  if (
    canonicalStringify(canonicalPublicationArtifacts(envelope.publicationArtifacts)) !==
      canonicalStringify(canonicalPublicationArtifacts(expectedArtifacts)) ||
    envelope.artifactSetDigest !==
      computeCommonsSeededPublicationArtifactSetDigest(expectedArtifacts)
  ) {
    addFinding(
      findings,
      "publication_artifact_record_mismatch",
      "The publication artifact ledger differs from the exact content-addressed vendor evidence records.",
      "Carry the predecessor artifact identifiers, hashes, media types, paths, and capture times without mutation.",
    );
  }
  for (const artifact of envelope.publicationArtifacts) {
    if (Date.parse(artifact.capturedAt) > preparedTime) {
      addFinding(
        findings,
        "publication_artifact_time_order_invalid",
        `Publication artifact ${artifact.artifactId} was captured after package preparation.`,
        "Capture and digest every publication evidence artifact before preparation.",
        { artifactId: artifact.artifactId },
      );
    }
  }
  if (envelope.unrestrictedEquivalenceClaimed !== false) {
    addFinding(
      findings,
      "unrestricted_equivalence_attempted",
      "The publication envelope attempts to claim unrestricted product equivalence.",
      "Keep unrestricted equivalence structurally false.",
    );
  }
  if (envelope.deploymentAuthorityClaimed !== false) {
    addFinding(
      findings,
      "deployment_authority_attempted",
      "The publication envelope attempts to authorize deployment.",
      "Keep deployment authority under the existing safety and release gates.",
    );
  }
  if (envelope.releaseAuthorityClaimed !== false) {
    addFinding(
      findings,
      "release_authority_attempted",
      "The publication envelope attempts to authorize an immutable release.",
      "Keep release authority under release-manifest and verification gates.",
    );
  }
  if (envelope.publicReleaseOccurred !== false) {
    addFinding(
      findings,
      "public_release_attempted",
      "The publication envelope claims that public release already occurred.",
      "Keep public release false until the exact release bundle is verified and registered.",
    );
  }

  const blockingStates = new Set<CommonsSeededPublicationFinding["state"]>([
    "publication_validation_failed",
    "vendor_parity_result_mismatch",
    "vendor_parity_not_admitted",
    "publication_package_digest_mismatch",
    "publication_envelope_digest_mismatch",
    "publication_case_mismatch",
    "publication_upstream_digest_mismatch",
    "publication_case_index_mismatch",
    "publication_claim_set_mismatch",
    "publication_vendor_parity_state_mismatch",
    "publication_disposition_mismatch",
    "publication_time_order_invalid",
    "rights_review_time_order_invalid",
    "safety_review_time_order_invalid",
    "publication_artifact_custody_missing",
    "publication_artifact_unexpected",
    "publication_artifact_record_mismatch",
    "publication_artifact_time_order_invalid",
    "ordinary_publication_gate_failed",
    "ordinary_publication_state_missing",
    "unrestricted_equivalence_attempted",
    "deployment_authority_attempted",
    "release_authority_attempted",
    "public_release_attempted",
  ]);

  let ordinaryGate: PublicationGateResult | undefined;
  let ordinaryGateDigest = "";
  if (!findings.some((finding) => blockingStates.has(finding.state))) {
    try {
      ordinaryGate = runPublicationGate(
        packageValue,
        expectedUpstreamDigests,
      );
      ordinaryGateDigest = sha256Hex(canonicalStringify(ordinaryGate));
      if (!ordinaryGate.state) {
        addFinding(
          findings,
          "ordinary_publication_state_missing",
          "The existing publication gate returned no recognized state.",
          "Repair the publication package without replacing the authoritative gate.",
        );
      }
    } catch (error) {
      addFinding(
        findings,
        "ordinary_publication_gate_failed",
        `The existing publication gate failed: ${String(error)}.`,
        "Repair the publication package without weakening claim custody.",
      );
    }
  }

  const state =
    findings.length === 0
      ? "seeded_publication_admitted"
      : findings.some((finding) => blockingStates.has(finding.state))
        ? "seeded_publication_blocked"
        : "seeded_publication_incomplete";

  return {
    passed: state === "seeded_publication_admitted",
    state,
    publicationReady: ordinaryGate?.passed ?? false,
    publicationState: ordinaryGate?.state,
    seededVendorParityResult: parityResult,
    seededVendorParityResultDigest: parityResultDigest,
    publicationPackageDigest: packageDigest,
    publicationEnvelopeDigest: envelopeDigest,
    claimSetDigest,
    upstreamDigestSetDigest,
    artifactSetDigest,
    ordinaryPublicationGate: ordinaryGate,
    ordinaryPublicationGateResultDigest: ordinaryGateDigest,
    expectedUpstreamDigests,
    expectedClaims,
    publicationPackage: packageValue,
    publicationArtifactIds: envelope.publicationArtifacts.map(
      (artifact) => artifact.artifactId,
    ),
    findings,
    validationErrors: [],
    pullList: dedupe(findings.map((finding) => finding.requiredAction)),
    prohibitedTransitions: [...COMMONS_SEEDED_PUBLICATION_PROHIBITED_TRANSITIONS],
  };
}
