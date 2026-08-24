import type {
  CommonsSeededPublicRegistryFinding,
  CommonsSeededPublicRegistryRequest,
  CommonsSeededPublicRegistryResult,
} from "../../types/garpaCommonsSeededPublicRegistry";
import { canonicalStringify } from "./canonicalJson";
import {
  canonicalPublicCaseRegistryEntry,
  canonicalRegistryIdentityPatch,
  computeCommonsSeededPublicRegistryEnvelopeDigest,
  computeCommonsSeededRegistryCurrentEntryDigest,
  computeCommonsSeededRegistryGateResultDigest,
  computeCommonsSeededRegistryIdentityPatchDigest,
  computeCommonsSeededRegistryNextEntryDigest,
  computeCommonsSeededRegistryReleaseHistoryDigest,
  computeCommonsSeededRegistryUpdateRequestDigest,
} from "./commonsSeededPublicRegistryDigest";
import { computeCommonsSeededReleaseResultDigest } from "./commonsSeededReleaseDigest";
import {
  deriveCommonsSeededInitialRegistryEntry,
  deriveCommonsSeededRegistryIdentityPatch,
  deriveCommonsSeededRegistryUpdateRequest,
} from "./deriveCommonsSeededPublicRegistry";
import { runCommonsSeededReleaseGate } from "./runCommonsSeededReleaseGate";
import { applyRegistryReleaseUpdate } from "./runRegistryUpdateGate";
import { validateCommonsSeededPublicRegistryRequest } from "./validateCommonsSeededPublicRegistry";

export const COMMONS_SEEDED_PUBLIC_REGISTRY_PROHIBITED_TRANSITIONS = [
  "Registry admission establishes one exact governing pointer inside the case record; it does not mean that an external public registry was published or that the release bundle was distributed.",
  "The initial Commons registry update admits only verified current R1 without invented predecessor, supersession, alias, rebrand, organization, tag, or release history.",
  "Registry admission does not establish deployment authority or unrestricted product equivalence, and it does not permit prior releases or identities to be rewritten in later updates.",
] as const;

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function addFinding(
  findings: CommonsSeededPublicRegistryFinding[],
  state: CommonsSeededPublicRegistryFinding["state"],
  reason: string,
  requiredAction: string,
  releaseId?: string,
): void {
  findings.push({ state, reason, requiredAction, releaseId });
}

function blockedResult(errors: string[]): CommonsSeededPublicRegistryResult {
  return {
    passed: false,
    state: "seeded_public_registry_blocked",
    registryUpdateApplied: false,
    seededReleaseResultDigest: "",
    currentEntryDigest: "",
    registryUpdateRequestDigest: "",
    registryEnvelopeDigest: "",
    identityPatchDigest: "",
    registryUpdateGateResultDigest: "",
    nextEntryDigest: "",
    releaseHistoryDigest: "",
    findings: errors.map((reason) => ({
      state: "public_registry_validation_failed" as const,
      reason,
      requiredAction:
        "Repair the Commons-seeded public-registry request and rerun validation.",
    })),
    validationErrors: errors,
    pullList: errors,
    prohibitedTransitions: [
      ...COMMONS_SEEDED_PUBLIC_REGISTRY_PROHIBITED_TRANSITIONS,
    ],
  };
}

export function runCommonsSeededPublicRegistryGate(
  input: CommonsSeededPublicRegistryRequest | unknown,
): CommonsSeededPublicRegistryResult {
  const validated = validateCommonsSeededPublicRegistryRequest(input);
  if (!validated.ok || !validated.value) return blockedResult(validated.errors);

  const request = validated.value;
  const findings: CommonsSeededPublicRegistryFinding[] = [];
  const envelope = request.registryEnvelope;
  const releaseResult = runCommonsSeededReleaseGate(
    request.seededReleaseRequest,
  );
  const releaseResultDigest =
    computeCommonsSeededReleaseResultDigest(releaseResult);
  const update = request.registryUpdateRequest;
  const currentEntryDigest =
    computeCommonsSeededRegistryCurrentEntryDigest(update.currentEntry);
  const updateDigest =
    computeCommonsSeededRegistryUpdateRequestDigest(update);
  const identityPatchDigest =
    computeCommonsSeededRegistryIdentityPatchDigest(update.identityPatch);
  const envelopeDigest =
    computeCommonsSeededPublicRegistryEnvelopeDigest(envelope);

  if (
    request.expectedSeededReleaseResultDigest !== releaseResultDigest ||
    envelope.seededReleaseResultDigest !== releaseResultDigest
  ) {
    addFinding(
      findings,
      "release_result_mismatch",
      "The expected or enveloped Commons-seeded release result digest does not match deterministic recomputation.",
      "Refresh the exact verified release result before registry admission.",
    );
  }
  if (!releaseResult.passed || !releaseResult.releaseManifest) {
    addFinding(
      findings,
      "release_record_not_admitted",
      "The governing Commons-seeded release record is not admitted.",
      "Resolve release custody before registry admission.",
    );
  }
  if (
    !releaseResult.releaseVerified ||
    releaseResult.releaseState !== "current_valid"
  ) {
    addFinding(
      findings,
      "release_not_verified",
      "The candidate release has not been verified as current_valid by the existing release verifiers.",
      "Verify the exact release manifest and bundle before registry admission.",
    );
  }
  if (envelope.registryUpdateRequestDigest !== updateDigest) {
    addFinding(
      findings,
      "registry_update_request_digest_mismatch",
      "The registry update request differs from the digest-bound envelope.",
      "Restore the immutable registry update request and recompute its digest.",
    );
  }
  if (envelope.envelopeDigest !== envelopeDigest) {
    addFinding(
      findings,
      "registry_envelope_digest_mismatch",
      "The registry-envelope digest does not match its canonical content.",
      "Restore the immutable registry envelope and recompute its digest.",
    );
  }

  const expectedCurrentEntry = releaseResult.releaseManifest
    ? deriveCommonsSeededInitialRegistryEntry(
        request.seededReleaseRequest,
        releaseResult,
      )
    : update.currentEntry;
  const expectedIdentityPatch = releaseResult.releaseManifest
    ? deriveCommonsSeededRegistryIdentityPatch(releaseResult)
    : update.identityPatch;
  const expectedUpdate = releaseResult.releaseManifest
    ? deriveCommonsSeededRegistryUpdateRequest(
        request.seededReleaseRequest,
        releaseResult,
        update.updatedAt,
      )
    : update;
  const publication = releaseResult.seededPublicationResult?.publicationPackage;
  const manifest = releaseResult.releaseManifest;

  if (
    update.currentEntry.caseId !== envelope.caseId ||
    update.candidateRelease.caseId !== envelope.caseId ||
    publication?.caseId !== envelope.caseId
  ) {
    addFinding(
      findings,
      "registry_case_mismatch",
      "The registry entry, candidate release, envelope, and publication package do not identify the same case.",
      "Admit the verified release into its exact target case entry.",
    );
  }
  if (
    !manifest ||
    update.candidateRelease.releaseId !== manifest.releaseId ||
    update.candidateRelease.releaseNumber !== manifest.releaseNumber ||
    update.candidateRelease.manifestDigest !== manifest.manifestDigest ||
    envelope.releaseId !== manifest.releaseId ||
    envelope.releaseNumber !== manifest.releaseNumber ||
    envelope.releaseManifestDigest !== manifest.manifestDigest ||
    envelope.releaseBundleDigest !== releaseResult.bundleDigest
  ) {
    addFinding(
      findings,
      "registry_release_mismatch",
      "The registry candidate or envelope does not carry the exact verified release identity, manifest, and bundle digest.",
      "Use the exact release returned by the admitted release-verification gate.",
      manifest?.releaseId,
    );
  }
  if (
    canonicalStringify(
      canonicalPublicCaseRegistryEntry(update.currentEntry),
    ) !==
      canonicalStringify(
        canonicalPublicCaseRegistryEntry(expectedCurrentEntry),
      ) ||
    envelope.currentEntryDigest !==
      computeCommonsSeededRegistryCurrentEntryDigest(expectedCurrentEntry)
  ) {
    addFinding(
      findings,
      "registry_current_entry_mismatch",
      "The submitted current registry entry invents or changes prior releases, identity, aliases, versions, tags, state, disposition, or timestamps.",
      "Start the initial R1 update from the deterministic empty release ledger and admitted publication identity.",
    );
  }
  if (
    canonicalStringify(
      canonicalRegistryIdentityPatch(update.identityPatch),
    ) !==
      canonicalStringify(
        canonicalRegistryIdentityPatch(expectedIdentityPatch),
      ) ||
    envelope.identityPatchDigest !==
      computeCommonsSeededRegistryIdentityPatchDigest(expectedIdentityPatch)
  ) {
    addFinding(
      findings,
      "registry_identity_patch_mismatch",
      "The identity patch invents or changes canonical subject, aliases, claimant, organization, offering version, lineage, or tags.",
      "Use the exact publication subject and verified R1 manifest coordinate without additional identity claims.",
    );
  }
  if (
    update.releaseVerificationState !== "current_valid" ||
    update.expectedCurrentReleaseId !== undefined ||
    update.expectedCurrentReleaseDigest !== undefined ||
    update.candidateCaseState !== "publication_ready" ||
    update.candidateDisposition !== publication?.disposition ||
    computeCommonsSeededRegistryUpdateRequestDigest(update) !==
      computeCommonsSeededRegistryUpdateRequestDigest(expectedUpdate)
  ) {
    addFinding(
      findings,
      "registry_transition_mismatch",
      "The registry update changes the verified release state, initial current-pointer expectation, case state, disposition, or deterministic update content.",
      "Apply the exact initial current R1 transition derived from the publication-ready release.",
    );
  }
  if (
    Date.parse(update.updatedAt) <
      Date.parse(request.seededReleaseRequest.admittedAt) ||
    envelope.updatedAt !== update.updatedAt ||
    Date.parse(request.admittedAt) < Date.parse(envelope.updatedAt)
  ) {
    addFinding(
      findings,
      "registry_time_order_invalid",
      "The registry update predates release admission, the envelope time differs from the update, or request admission predates registry evaluation.",
      "Restore chronology across release admission, registry update, envelope capture, and registry-record admission.",
    );
  }
  if (envelope.publicRegistryPublished !== false) {
    addFinding(
      findings,
      "public_registry_publication_attempted",
      "The registry envelope claims that an external public registry was already published.",
      "Keep external publication false until the verified entry is exported through a separately controlled publication mechanism.",
    );
  }
  if (envelope.publicReleaseOccurred !== false) {
    addFinding(
      findings,
      "public_release_attempted",
      "The registry envelope claims that the verified bundle was publicly distributed.",
      "Keep public release false until a separately controlled distribution receipt exists.",
    );
  }
  if (envelope.deploymentAuthorityClaimed !== false) {
    addFinding(
      findings,
      "deployment_authority_attempted",
      "The registry envelope attempts to authorize deployment.",
      "Keep deployment authority under the existing safety and operational controls.",
    );
  }
  if (envelope.unrestrictedEquivalenceClaimed !== false) {
    addFinding(
      findings,
      "unrestricted_equivalence_attempted",
      "The registry envelope attempts to claim unrestricted product equivalence.",
      "Keep unrestricted equivalence structurally false.",
    );
  }

  const blockingStates = new Set<
    CommonsSeededPublicRegistryFinding["state"]
  >([
    "public_registry_validation_failed",
    "release_result_mismatch",
    "release_record_not_admitted",
    "release_not_verified",
    "registry_update_request_digest_mismatch",
    "registry_envelope_digest_mismatch",
    "registry_case_mismatch",
    "registry_release_mismatch",
    "registry_time_order_invalid",
    "registry_current_entry_mismatch",
    "registry_identity_patch_mismatch",
    "registry_transition_mismatch",
    "ordinary_registry_gate_failed",
    "ordinary_registry_entry_missing",
    "registry_gate_result_digest_mismatch",
    "registry_next_entry_digest_mismatch",
    "registry_release_history_mismatch",
    "public_registry_publication_attempted",
    "public_release_attempted",
    "deployment_authority_attempted",
    "unrestricted_equivalence_attempted",
  ]);

  let ordinaryRegistryUpdate;
  let gateDigest = "";
  let nextEntryDigest = "";
  let releaseHistoryDigest = "";
  if (!findings.some((finding) => blockingStates.has(finding.state))) {
    ordinaryRegistryUpdate = applyRegistryReleaseUpdate(update);
    gateDigest = computeCommonsSeededRegistryGateResultDigest(
      ordinaryRegistryUpdate.gate,
    );
    if (!ordinaryRegistryUpdate.gate.passed) {
      addFinding(
        findings,
        "ordinary_registry_gate_failed",
        `The existing registry gate refused the update with state ${ordinaryRegistryUpdate.gate.state}.`,
        "Resolve every current pointer, release sequence, lineage, identity, and case-transition finding.",
      );
    }
    if (!ordinaryRegistryUpdate.entry) {
      addFinding(
        findings,
        "ordinary_registry_entry_missing",
        "The existing registry application returned no updated case entry.",
        "Repair the registry request without replacing the authoritative gate.",
      );
    } else {
      nextEntryDigest = computeCommonsSeededRegistryNextEntryDigest(
        ordinaryRegistryUpdate.entry,
      );
      releaseHistoryDigest =
        computeCommonsSeededRegistryReleaseHistoryDigest(
          ordinaryRegistryUpdate.entry.releases,
        );
    }
  }
  if (
    gateDigest &&
    envelope.registryUpdateGateResultDigest !== gateDigest
  ) {
    addFinding(
      findings,
      "registry_gate_result_digest_mismatch",
      "The registry envelope does not preserve the exact ordinary gate result digest.",
      "Bind the exact existing registry-gate result into the envelope.",
    );
  }
  if (
    nextEntryDigest &&
    envelope.nextEntryDigest !== nextEntryDigest
  ) {
    addFinding(
      findings,
      "registry_next_entry_digest_mismatch",
      "The registry envelope does not preserve the exact updated case entry digest.",
      "Bind the exact entry returned by the existing registry application.",
    );
  }
  if (
    releaseHistoryDigest &&
    envelope.releaseHistoryDigest !== releaseHistoryDigest
  ) {
    addFinding(
      findings,
      "registry_release_history_mismatch",
      "The registry envelope does not preserve the exact release history digest.",
      "Bind the complete immutable release history returned by the registry application.",
    );
  }

  const state =
    findings.length === 0
      ? "seeded_public_registry_admitted"
      : findings.some((finding) => blockingStates.has(finding.state))
        ? "seeded_public_registry_blocked"
        : "seeded_public_registry_incomplete";

  return {
    passed: state === "seeded_public_registry_admitted",
    state,
    registryUpdateApplied: Boolean(
      ordinaryRegistryUpdate?.gate.passed &&
        ordinaryRegistryUpdate.entry,
    ),
    registryState: ordinaryRegistryUpdate?.gate.state,
    seededReleaseResult: releaseResult,
    seededReleaseResultDigest: releaseResultDigest,
    currentEntryDigest,
    registryUpdateRequestDigest: updateDigest,
    registryEnvelopeDigest: envelopeDigest,
    identityPatchDigest,
    registryUpdateGateResultDigest: gateDigest,
    nextEntryDigest,
    releaseHistoryDigest,
    ordinaryRegistryUpdate,
    currentEntry: update.currentEntry,
    nextEntry: ordinaryRegistryUpdate?.entry,
    identityPatch: update.identityPatch,
    findings,
    validationErrors: [],
    pullList: dedupe(findings.map((finding) => finding.requiredAction)),
    prohibitedTransitions: [
      ...COMMONS_SEEDED_PUBLIC_REGISTRY_PROHIBITED_TRANSITIONS,
    ],
  };
}
