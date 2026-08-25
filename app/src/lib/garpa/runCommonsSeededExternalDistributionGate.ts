import type { ReleaseFileRecord } from "../../types/garpaRelease";
import type {
  CommonsSeededDistributionEvidenceArtifact,
  CommonsSeededExternalDistributionFinding,
  CommonsSeededExternalDistributionRequest,
  CommonsSeededExternalDistributionResult,
} from "../../types/garpaCommonsSeededExternalDistribution";
import { canonicalStringify } from "./canonicalJson";
import { canonicalReleaseFileRecords } from "./commonsSeededReleaseDigest";
import {
  computeCommonsSeededExternalDistributionEnvelopeDigest,
  computeCommonsSeededExternalDistributionEvidenceArtifactSetDigest,
  computeCommonsSeededExternalDistributionObservationDigest,
  computeCommonsSeededExternalDistributionObservedFileSetDigest,
} from "./commonsSeededExternalDistributionDigest";
import { computeCommonsSeededPublicRegistryResultDigest } from "./commonsSeededPublicRegistryDigest";
import {
  deriveCommonsSeededExternalDistributionFiles,
  deriveCommonsSeededQualificationDistributionObservation,
} from "./deriveCommonsSeededExternalDistribution";
import { runCommonsSeededPublicRegistryGate } from "./runCommonsSeededPublicRegistryGate";
import { validateCommonsSeededExternalDistributionRequest } from "./validateCommonsSeededExternalDistribution";

export const COMMONS_SEEDED_EXTERNAL_DISTRIBUTION_PROHIBITED_TRANSITIONS = [
  "A qualification fixture exercises receipt custody only and may never be represented as an observed external publication or distribution event.",
  "An observed external event requires the exact governing release bytes plus independently attributable platform and retrieval evidence; a claimant assertion alone is insufficient.",
  "External distribution or registry publication does not establish deployment authority or unrestricted product equivalence.",
] as const;

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function addFinding(
  findings: CommonsSeededExternalDistributionFinding[],
  state: CommonsSeededExternalDistributionFinding["state"],
  reason: string,
  requiredAction: string,
  options?: { artifactId?: string; path?: string },
): void {
  findings.push({
    state,
    reason,
    requiredAction,
    artifactId: options?.artifactId,
    path: options?.path,
  });
}

function blockedResult(
  errors: string[],
): CommonsSeededExternalDistributionResult {
  return {
    passed: false,
    state: "seeded_external_distribution_blocked",
    receiptAdmitted: false,
    eventObserved: false,
    publicRegistryPublished: false,
    publicReleaseOccurred: false,
    seededPublicRegistryResultDigest: "",
    distributionObservationDigest: "",
    distributionEnvelopeDigest: "",
    observedFileSetDigest: "",
    evidenceArtifactSetDigest: "",
    expectedFiles: [],
    observedFiles: [],
    evidenceArtifacts: [],
    findings: errors.map((reason) => ({
      state: "external_distribution_validation_failed" as const,
      reason,
      requiredAction:
        "Repair the Commons-seeded external-distribution request and rerun validation.",
    })),
    validationErrors: errors,
    pullList: errors,
    prohibitedTransitions: [
      ...COMMONS_SEEDED_EXTERNAL_DISTRIBUTION_PROHIBITED_TRANSITIONS,
    ],
  };
}

function exactFileSet(
  left: ReleaseFileRecord[],
  right: ReleaseFileRecord[],
): boolean {
  return (
    canonicalStringify(canonicalReleaseFileRecords(left)) ===
    canonicalStringify(canonicalReleaseFileRecords(right))
  );
}

function isHttpsUri(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function eventPublishesRelease(
  eventKind: CommonsSeededExternalDistributionRequest[
    "distributionObservation"
  ]["eventKind"],
): boolean {
  return (
    eventKind === "release_distribution" ||
    eventKind === "release_and_registry_publication"
  );
}

function eventPublishesRegistry(
  eventKind: CommonsSeededExternalDistributionRequest[
    "distributionObservation"
  ]["eventKind"],
): boolean {
  return (
    eventKind === "registry_publication" ||
    eventKind === "release_and_registry_publication"
  );
}

function hasExternallyAttributablePlatformReceipt(
  artifacts: CommonsSeededDistributionEvidenceArtifact[],
): boolean {
  return artifacts.some(
    (artifact) =>
      artifact.role === "platform_receipt" &&
      ["externally_attributed", "independent"].includes(
        artifact.evidenceControl,
      ),
  );
}

function hasRetrievalCapture(
  artifacts: CommonsSeededDistributionEvidenceArtifact[],
): boolean {
  return artifacts.some(
    (artifact) =>
      artifact.role === "retrieval_capture" &&
      ["local_measured", "independent"].includes(
        artifact.evidenceControl,
      ),
  );
}

function hasRegistrySnapshot(
  artifacts: CommonsSeededDistributionEvidenceArtifact[],
): boolean {
  return artifacts.some(
    (artifact) =>
      artifact.role === "registry_snapshot" &&
      ["externally_attributed", "independent", "local_measured"].includes(
        artifact.evidenceControl,
      ),
  );
}

export function runCommonsSeededExternalDistributionGate(
  input: CommonsSeededExternalDistributionRequest | unknown,
): CommonsSeededExternalDistributionResult {
  const validated =
    validateCommonsSeededExternalDistributionRequest(input);
  if (!validated.ok || !validated.value) {
    return blockedResult(validated.errors);
  }

  const request = validated.value;
  const findings: CommonsSeededExternalDistributionFinding[] = [];
  const observation = request.distributionObservation;
  const envelope = request.distributionEnvelope;
  const registryResult = runCommonsSeededPublicRegistryGate(
    request.seededPublicRegistryRequest,
  );
  const registryResultDigest =
    computeCommonsSeededPublicRegistryResultDigest(registryResult);
  const observationDigest =
    computeCommonsSeededExternalDistributionObservationDigest(
      observation,
    );
  const envelopeDigest =
    computeCommonsSeededExternalDistributionEnvelopeDigest(envelope);
  const observedFileSetDigest =
    computeCommonsSeededExternalDistributionObservedFileSetDigest(
      observation.observedFiles,
    );
  const evidenceArtifactSetDigest =
    computeCommonsSeededExternalDistributionEvidenceArtifactSetDigest(
      observation.evidenceArtifacts,
    );
  const manifest = registryResult.seededReleaseResult?.releaseManifest;
  const registryEntry = registryResult.nextEntry;
  const expectedFiles =
    manifest && registryEntry
      ? deriveCommonsSeededExternalDistributionFiles(registryResult)
      : [];

  if (
    request.expectedSeededPublicRegistryResultDigest !==
      registryResultDigest ||
    envelope.seededPublicRegistryResultDigest !== registryResultDigest
  ) {
    addFinding(
      findings,
      "public_registry_result_mismatch",
      "The expected or enveloped Commons-seeded public-registry result digest does not match deterministic recomputation.",
      "Refresh the exact admitted registry result before constructing a distribution receipt.",
    );
  }
  if (
    !registryResult.passed ||
    !registryResult.registryUpdateApplied ||
    registryResult.registryState !== "registry_update_admitted" ||
    !manifest ||
    !registryEntry
  ) {
    addFinding(
      findings,
      "public_registry_record_not_admitted",
      "The governing Commons-seeded public-registry record is not admitted and complete.",
      "Resolve registry custody before attempting external-distribution admission.",
    );
  }
  if (
    !manifest ||
    !registryEntry ||
    registryEntry.currentReleaseId !== manifest.releaseId ||
    registryEntry.currentReleaseDigest !== manifest.manifestDigest
  ) {
    addFinding(
      findings,
      "governing_release_pointer_mismatch",
      "The admitted registry entry does not point to the exact verified release manifest.",
      "Use the sole current release returned by the admitted public-registry stage.",
    );
  }
  if (
    observation.observationDigest !== observationDigest ||
    envelope.distributionObservationDigest !== observationDigest
  ) {
    addFinding(
      findings,
      "distribution_observation_digest_mismatch",
      "The distribution observation or envelope does not preserve the canonical observation digest.",
      "Restore the immutable observation and recompute its canonical digest.",
    );
  }
  if (envelope.envelopeDigest !== envelopeDigest) {
    addFinding(
      findings,
      "distribution_envelope_digest_mismatch",
      "The distribution-envelope digest does not match its canonical content.",
      "Restore the immutable distribution envelope and recompute its digest.",
    );
  }
  if (
    !manifest ||
    !registryEntry ||
    observation.caseId !== manifest.caseId ||
    envelope.caseId !== manifest.caseId
  ) {
    addFinding(
      findings,
      "distribution_case_mismatch",
      "The observation, envelope, registry entry, and release manifest do not identify the same case.",
      "Bind the receipt to the exact admitted case.",
    );
  }
  if (
    !manifest ||
    observation.releaseId !== manifest.releaseId ||
    observation.releaseNumber !== manifest.releaseNumber ||
    observation.releaseManifestDigest !== manifest.manifestDigest ||
    observation.releaseBundleDigest !==
      registryResult.seededReleaseResult?.bundleDigest ||
    envelope.releaseId !== manifest.releaseId ||
    envelope.releaseNumber !== manifest.releaseNumber ||
    envelope.releaseManifestDigest !== manifest.manifestDigest ||
    envelope.releaseBundleDigest !==
      registryResult.seededReleaseResult?.bundleDigest
  ) {
    addFinding(
      findings,
      "distribution_release_mismatch",
      "The observation or envelope does not carry the exact governing release identity, manifest digest, and bundle digest.",
      "Use the exact release and bundle admitted by the registry predecessor.",
    );
  }
  if (
    !registryEntry ||
    observation.registryEntryDigest !== registryResult.nextEntryDigest ||
    envelope.registryEntryDigest !== registryResult.nextEntryDigest
  ) {
    addFinding(
      findings,
      "distribution_registry_entry_mismatch",
      "The distribution receipt is not bound to the exact admitted registry-entry digest.",
      "Bind the receipt to the immutable governing registry entry.",
    );
  }
  if (
    envelope.mode !== observation.mode ||
    envelope.eventKind !== observation.eventKind
  ) {
    addFinding(
      findings,
      "distribution_mode_mismatch",
      "The observation and envelope disagree about fixture versus observed-event mode or event kind.",
      "Use one exact mode and event kind throughout the receipt.",
    );
  }
  if (
    envelope.observedFileSetDigest !== observedFileSetDigest ||
    !exactFileSet(observation.observedFiles, expectedFiles)
  ) {
    addFinding(
      findings,
      "distribution_file_set_mismatch",
      "The externally observed file records do not exactly match the verified release manifest.",
      "Retrieve and account for every governing release file with exact digest, byte length, role, media type, and required state.",
    );
  }
  if (
    envelope.evidenceArtifactSetDigest !== evidenceArtifactSetDigest
  ) {
    addFinding(
      findings,
      "distribution_artifact_set_mismatch",
      "The envelope does not preserve the canonical external-evidence artifact set.",
      "Bind the complete content-addressed artifact ledger into the envelope.",
    );
  }

  for (const artifact of observation.evidenceArtifacts) {
    if (
      !artifact.artifactId.trim() ||
      !artifact.uri.trim() ||
      !artifact.mediaType.trim()
    ) {
      addFinding(
        findings,
        "distribution_artifact_custody_missing",
        `Evidence artifact ${artifact.artifactId || "(unidentified)"} lacks an identifier, URI, or media type.`,
        "Provide complete content-addressed evidence-artifact custody.",
        { artifactId: artifact.artifactId },
      );
    }
    if (
      observation.mode === "observed_external_event" &&
      !isHttpsUri(artifact.uri)
    ) {
      addFinding(
        findings,
        "distribution_uri_invalid",
        `Evidence artifact ${artifact.artifactId} is not addressed by HTTPS.`,
        "Use externally retrievable HTTPS evidence-artifact locations for observed events.",
        { artifactId: artifact.artifactId },
      );
    }
    if (
      Date.parse(artifact.capturedAt) < Date.parse(observation.publishedAt) ||
      Date.parse(artifact.capturedAt) > Date.parse(observation.observedAt)
    ) {
      addFinding(
        findings,
        "distribution_artifact_time_order_invalid",
        `Evidence artifact ${artifact.artifactId} was captured outside the asserted publication-to-observation window.`,
        "Restore artifact capture chronology.",
        { artifactId: artifact.artifactId },
      );
    }
  }

  if (
    Date.parse(observation.publishedAt) <
      Date.parse(request.seededPublicRegistryRequest.admittedAt) ||
    Date.parse(observation.observedAt) <
      Date.parse(observation.publishedAt) ||
    Date.parse(envelope.evaluatedAt) <
      Date.parse(observation.observedAt) ||
    Date.parse(request.admittedAt) <
      Date.parse(envelope.evaluatedAt)
  ) {
    addFinding(
      findings,
      "distribution_time_order_invalid",
      "Publication predates registry admission, observation predates publication, evaluation predates observation, or request admission predates evaluation.",
      "Restore chronology across registry admission, publication, observation, evaluation, and receipt admission.",
    );
  }

  const observedEvent =
    observation.mode === "observed_external_event";
  const expectedPublicRelease =
    observedEvent && eventPublishesRelease(observation.eventKind);
  const expectedRegistryPublication =
    observedEvent && eventPublishesRegistry(observation.eventKind);

  if (observation.mode === "qualification_fixture") {
    if (manifest && registryEntry) {
      const expectedFixture =
        deriveCommonsSeededQualificationDistributionObservation(
          registryResult,
          observation.publishedAt,
          observation.observedAt,
        );
      if (
        canonicalStringify({
          ...observation,
          observationDigest,
        }) !== canonicalStringify(expectedFixture)
      ) {
        addFinding(
          findings,
          "distribution_mode_mismatch",
          "The qualification fixture differs from the deterministic non-public fixture derived from the admitted registry result.",
          "Regenerate the qualification fixture from the exact registry predecessor.",
        );
      }
    }
    const fixtureArtifactsOnly =
      observation.evidenceArtifacts.every(
        (artifact) =>
          artifact.role === "qualification_fixture" &&
          artifact.evidenceControl === "local_measured",
      );
    if (
      observation.syntheticFixture !== true ||
      observation.externallyAccessible !== false ||
      !observation.destinationUri.startsWith(
        "urn:garpa:qualification-fixture:",
      ) ||
      !fixtureArtifactsOnly
    ) {
      addFinding(
        findings,
        "distribution_mode_mismatch",
        "Qualification-fixture mode must remain synthetic, inaccessible, URN-addressed, and supported only by local qualification-fixture artifacts.",
        "Restore the non-public qualification fixture without external-event assertions.",
      );
    }
    if (
      envelope.publicReleaseOccurred ||
      envelope.publicRegistryPublished
    ) {
      addFinding(
        findings,
        "synthetic_fixture_publication_attempted",
        "A qualification fixture attempts to assert an observed public release or public-registry publication.",
        "Keep both external-event flags false for qualification fixtures.",
      );
    }
  } else {
    if (
      observation.syntheticFixture !== false ||
      observation.externallyAccessible !== true ||
      !isHttpsUri(observation.destinationUri)
    ) {
      addFinding(
        findings,
        "distribution_uri_invalid",
        "Observed external-event mode requires a non-synthetic, externally accessible HTTPS destination.",
        "Supply the exact externally retrievable HTTPS location and mark the observation non-synthetic.",
      );
    }
    if (
      eventPublishesRegistry(observation.eventKind) &&
      observation.channel !== "public_registry_export"
    ) {
      addFinding(
        findings,
        "distribution_mode_mismatch",
        "A registry-publication event must use the public_registry_export channel.",
        "Use the registry-export channel for any asserted public-registry publication.",
      );
    }
    const platformReceipt =
      hasExternallyAttributablePlatformReceipt(
        observation.evidenceArtifacts,
      );
    const retrievalCapture = hasRetrievalCapture(
      observation.evidenceArtifacts,
    );
    const registrySnapshot =
      !eventPublishesRegistry(observation.eventKind) ||
      hasRegistrySnapshot(observation.evidenceArtifacts);
    if (!platformReceipt || !retrievalCapture || !registrySnapshot) {
      addFinding(
        findings,
        "external_event_evidence_insufficient",
        "Observed external-event mode lacks an externally attributable platform receipt, an independent or locally measured retrieval capture, or the required registry snapshot.",
        "Provide content-addressed evidence for platform publication, retrieval of the exact release bytes, and any asserted public-registry publication.",
      );
    }
  }

  if (
    envelope.publicReleaseOccurred !== expectedPublicRelease
  ) {
    addFinding(
      findings,
      "public_release_flag_mismatch",
      "The public-release flag does not match the observed-event mode and event kind.",
      "Set publicReleaseOccurred only for an observed release-distribution event.",
    );
  }
  if (
    envelope.publicRegistryPublished !==
      expectedRegistryPublication
  ) {
    addFinding(
      findings,
      "public_registry_flag_mismatch",
      "The public-registry flag does not match the observed-event mode and event kind.",
      "Set publicRegistryPublished only for an observed registry-publication event.",
    );
  }
  if (envelope.deploymentAuthorityClaimed !== false) {
    addFinding(
      findings,
      "deployment_authority_attempted",
      "The distribution envelope attempts to authorize deployment.",
      "Keep deployment authority under separate safety and operational controls.",
    );
  }
  if (envelope.unrestrictedEquivalenceClaimed !== false) {
    addFinding(
      findings,
      "unrestricted_equivalence_attempted",
      "The distribution envelope attempts to claim unrestricted product equivalence.",
      "Keep unrestricted equivalence structurally false.",
    );
  }

  const blocked = findings.length > 0;
  const state = blocked
    ? "seeded_external_distribution_blocked"
    : observedEvent
      ? "seeded_external_distribution_observed"
      : "seeded_external_distribution_fixture_admitted";

  return {
    passed: !blocked,
    state,
    receiptAdmitted: !blocked,
    eventObserved: !blocked && observedEvent,
    publicRegistryPublished:
      !blocked && envelope.publicRegistryPublished,
    publicReleaseOccurred:
      !blocked && envelope.publicReleaseOccurred,
    mode: observation.mode,
    eventKind: observation.eventKind,
    seededPublicRegistryResult: registryResult,
    seededPublicRegistryResultDigest: registryResultDigest,
    distributionObservationDigest: observationDigest,
    distributionEnvelopeDigest: envelopeDigest,
    observedFileSetDigest,
    evidenceArtifactSetDigest,
    expectedFiles,
    observedFiles: observation.observedFiles,
    evidenceArtifacts: observation.evidenceArtifacts,
    findings,
    validationErrors: [],
    pullList: dedupe(
      findings.map((finding) => finding.requiredAction),
    ),
    prohibitedTransitions: [
      ...COMMONS_SEEDED_EXTERNAL_DISTRIBUTION_PROHIBITED_TRANSITIONS,
    ],
  };
}
