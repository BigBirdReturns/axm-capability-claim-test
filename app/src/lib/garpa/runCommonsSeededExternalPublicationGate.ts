import type {
  CommonsSeededExternalPublicationFinding,
  CommonsSeededExternalPublicationRequest,
  CommonsSeededExternalPublicationResult,
} from "../../types/garpaCommonsSeededExternalPublication";
import {
  computeCommonsSeededExternalPublicationEnvelopeDigest,
} from "./commonsSeededExternalPublicationDigest";
import {
  computeExternalPublicationArtifactSetDigest,
  computeExternalPublicationReceiptDigest,
  computeExternalPublicationReceiptRequestDigest,
  computeExternalPublicationReceiptResultDigest,
} from "./externalPublicationDigest";
import {
  computeCommonsSeededPublicRegistryResultDigest,
  computeCommonsSeededRegistryNextEntryDigest,
} from "./commonsSeededPublicRegistryDigest";
import { runExternalPublicationReceiptGate } from "./runExternalPublicationReceiptGate";
import { runCommonsSeededPublicRegistryGate } from "./runCommonsSeededPublicRegistryGate";
import { validateCommonsSeededExternalPublicationRequest } from "./validateCommonsSeededExternalPublication";

export const COMMONS_SEEDED_EXTERNAL_PUBLICATION_PROHIBITED_TRANSITIONS = [
  "A synthetic qualification receipt proves only that the custody mechanism executes; it does not prove that any external publication or distribution event occurred.",
  "An observed external receipt proves only the exact event, locator, target digest, publisher, and observation window recorded; it does not establish permanence, discoverability, audience reach, or continued availability.",
  "External publication or distribution does not establish deployment authority or unrestricted product equivalence.",
] as const;

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function addFinding(
  findings: CommonsSeededExternalPublicationFinding[],
  state: CommonsSeededExternalPublicationFinding["state"],
  reason: string,
  requiredAction: string,
  artifactId?: string,
): void {
  findings.push({ state, reason, requiredAction, artifactId });
}

function blockedResult(errors: string[]): CommonsSeededExternalPublicationResult {
  return {
    passed: false,
    state: "seeded_external_publication_blocked",
    receiptAdmitted: false,
    externalEventObserved: false,
    syntheticQualificationOnly: true,
    publicRegistryPublished: false,
    publicReleaseOccurred: false,
    seededPublicRegistryResultDigest: "",
    registryEntryDigest: "",
    externalPublicationRequestDigest: "",
    externalPublicationReceiptDigest: "",
    externalArtifactSetDigest: "",
    publicationEnvelopeDigest: "",
    ordinaryReceiptResultDigest: "",
    findings: errors.map((reason) => ({
      state: "external_publication_validation_failed" as const,
      reason,
      requiredAction:
        "Repair the Commons-seeded external-publication request and rerun validation.",
    })),
    validationErrors: errors,
    pullList: errors,
    prohibitedTransitions: [
      ...COMMONS_SEEDED_EXTERNAL_PUBLICATION_PROHIBITED_TRANSITIONS,
    ],
  };
}

export function runCommonsSeededExternalPublicationGate(
  input: CommonsSeededExternalPublicationRequest | unknown,
): CommonsSeededExternalPublicationResult {
  const validated = validateCommonsSeededExternalPublicationRequest(input);
  if (!validated.ok || !validated.value) return blockedResult(validated.errors);

  const request = validated.value;
  const findings: CommonsSeededExternalPublicationFinding[] = [];
  const envelope = request.publicationEnvelope;
  const externalRequest = request.externalPublicationRequest;
  const receipt = externalRequest.receipt;
  const registryResult = runCommonsSeededPublicRegistryGate(
    request.seededPublicRegistryRequest,
  );
  const registryResultDigest =
    computeCommonsSeededPublicRegistryResultDigest(registryResult);
  const registryEntryDigest = registryResult.nextEntry
    ? computeCommonsSeededRegistryNextEntryDigest(registryResult.nextEntry)
    : "";
  const externalRequestDigest =
    computeExternalPublicationReceiptRequestDigest(externalRequest);
  const externalReceiptDigest =
    computeExternalPublicationReceiptDigest(receipt);
  const artifactSetDigest = computeExternalPublicationArtifactSetDigest(
    externalRequest.artifacts,
  );
  const envelopeDigest =
    computeCommonsSeededExternalPublicationEnvelopeDigest(envelope);
  const ordinaryReceiptResult = runExternalPublicationReceiptGate(
    externalRequest,
  );
  const ordinaryReceiptResultDigest =
    computeExternalPublicationReceiptResultDigest(ordinaryReceiptResult);
  const releaseResult = registryResult.seededReleaseResult;
  const manifest = releaseResult?.releaseManifest;

  if (
    request.expectedSeededPublicRegistryResultDigest !== registryResultDigest ||
    envelope.seededPublicRegistryResultDigest !== registryResultDigest
  ) {
    addFinding(
      findings,
      "public_registry_result_mismatch",
      "The expected or enveloped Commons-seeded public-registry result digest does not match deterministic recomputation.",
      "Refresh the exact admitted public-registry result before constructing an external-publication receipt.",
    );
  }
  if (!registryResult.passed || !registryResult.registryUpdateApplied) {
    addFinding(
      findings,
      "public_registry_record_not_admitted",
      "The governing Commons-seeded public-registry record is not admitted.",
      "Resolve registry custody before admitting external publication evidence.",
    );
  }
  if (!registryResult.nextEntry) {
    addFinding(
      findings,
      "public_registry_entry_missing",
      "The admitted registry result contains no updated case entry.",
      "Restore the exact entry returned by the authoritative registry application.",
    );
  }
  if (envelope.externalPublicationRequestDigest !== externalRequestDigest) {
    addFinding(
      findings,
      "external_publication_request_digest_mismatch",
      "The external-publication request differs from the digest-bound envelope.",
      "Restore the immutable receipt request and recompute its digest.",
    );
  }
  if (envelope.envelopeDigest !== envelopeDigest) {
    addFinding(
      findings,
      "external_publication_envelope_digest_mismatch",
      "The external-publication envelope digest does not match its canonical content.",
      "Restore the immutable envelope and recompute its digest.",
    );
  }

  if (
    receipt.caseId !== envelope.caseId ||
    registryResult.nextEntry?.caseId !== envelope.caseId ||
    manifest?.caseId !== envelope.caseId
  ) {
    addFinding(
      findings,
      "external_publication_case_mismatch",
      "The receipt, registry entry, release manifest, and envelope do not identify the same case.",
      "Observe and receipt the exact admitted case.",
    );
  }
  if (
    !manifest ||
    receipt.releaseId !== manifest.releaseId ||
    envelope.releaseId !== manifest.releaseId ||
    envelope.releaseNumber !== manifest.releaseNumber ||
    receipt.releaseManifestDigest !== manifest.manifestDigest ||
    envelope.releaseManifestDigest !== manifest.manifestDigest ||
    receipt.releaseBundleDigest !== releaseResult?.bundleDigest ||
    envelope.releaseBundleDigest !== releaseResult?.bundleDigest ||
    registryResult.nextEntry?.currentReleaseId !== manifest.releaseId ||
    registryResult.nextEntry?.currentReleaseDigest !== manifest.manifestDigest
  ) {
    addFinding(
      findings,
      "external_publication_release_mismatch",
      "The external receipt or envelope does not carry the exact current verified release identity, manifest, bundle, and registry pointer.",
      "Bind the receipt to the exact governing release returned by the admitted registry result.",
    );
  }
  if (
    !registryEntryDigest ||
    receipt.registryEntryDigest !== registryEntryDigest ||
    envelope.registryEntryDigest !== registryEntryDigest
  ) {
    addFinding(
      findings,
      "external_publication_registry_entry_mismatch",
      "The receipt or envelope does not preserve the exact admitted registry-entry digest.",
      "Bind the observed event to the complete current registry entry.",
    );
  }
  if (
    envelope.externalPublicationReceiptId !== receipt.receiptId ||
    envelope.externalPublicationReceiptDigest !== externalReceiptDigest ||
    envelope.externalArtifactSetDigest !== artifactSetDigest
  ) {
    addFinding(
      findings,
      "external_publication_request_digest_mismatch",
      "The envelope does not preserve the exact receipt identity, receipt digest, and capture-artifact set digest.",
      "Bind the exact ordinary receipt and its complete capture ledger into the envelope.",
    );
  }
  if (
    Date.parse(receipt.publishedAt) <
      Date.parse(request.seededPublicRegistryRequest.admittedAt) ||
    envelope.observedAt !== receipt.observedAt ||
    Date.parse(externalRequest.admittedAt) < Date.parse(receipt.observedAt) ||
    Date.parse(request.admittedAt) < Date.parse(externalRequest.admittedAt)
  ) {
    addFinding(
      findings,
      "external_publication_time_order_invalid",
      "The claimed event predates registry admission, observation and receipt times disagree, or admission chronology regresses.",
      "Restore chronology across registry admission, publication, observation, receipt admission, and Commons admission.",
    );
  }

  if (!ordinaryReceiptResult.passed) {
    addFinding(
      findings,
      "ordinary_external_publication_receipt_failed",
      `The ordinary external-publication receipt gate refused the evidence with state ${ordinaryReceiptResult.state}.`,
      "Resolve every receipt, artifact, locator, chronology, target, and event-semantics finding.",
    );
  }
  if (envelope.ordinaryReceiptResultDigest !== ordinaryReceiptResultDigest) {
    addFinding(
      findings,
      "ordinary_external_publication_result_digest_mismatch",
      "The envelope does not preserve the exact ordinary receipt-gate result digest.",
      "Bind the exact ordinary external-publication receipt result into the envelope.",
    );
  }
  if (
    envelope.evidenceClass !== ordinaryReceiptResult.evidenceClass ||
    envelope.eventKind !== ordinaryReceiptResult.eventKind ||
    envelope.syntheticQualificationOnly !==
      ordinaryReceiptResult.syntheticQualificationOnly ||
    envelope.externalEventObserved !== ordinaryReceiptResult.eventObserved ||
    envelope.publicRegistryPublished !==
      ordinaryReceiptResult.publicRegistryPublished ||
    envelope.publicReleaseOccurred !==
      ordinaryReceiptResult.publicReleaseOccurred
  ) {
    addFinding(
      findings,
      "external_publication_event_state_mismatch",
      "The Commons envelope changes the evidence class, event kind, qualification boundary, or occurrence state returned by the ordinary receipt gate.",
      "Preserve the exact ordinary event disposition without promotion or suppression.",
    );
  }
  if (envelope.deploymentAuthorityClaimed !== false) {
    addFinding(
      findings,
      "deployment_authority_attempted",
      "The external-publication envelope attempts to authorize deployment.",
      "Keep deployment authority under the existing safety and operational controls.",
    );
  }
  if (envelope.unrestrictedEquivalenceClaimed !== false) {
    addFinding(
      findings,
      "unrestricted_equivalence_attempted",
      "The external-publication envelope attempts to claim unrestricted product equivalence.",
      "Keep unrestricted equivalence structurally false.",
    );
  }

  const blockingStates = new Set<
    CommonsSeededExternalPublicationFinding["state"]
  >([
    "external_publication_validation_failed",
    "public_registry_result_mismatch",
    "public_registry_record_not_admitted",
    "public_registry_entry_missing",
    "external_publication_request_digest_mismatch",
    "external_publication_envelope_digest_mismatch",
    "external_publication_case_mismatch",
    "external_publication_release_mismatch",
    "external_publication_registry_entry_mismatch",
    "external_publication_time_order_invalid",
    "ordinary_external_publication_receipt_failed",
    "ordinary_external_publication_result_digest_mismatch",
    "external_publication_event_state_mismatch",
    "deployment_authority_attempted",
    "unrestricted_equivalence_attempted",
  ]);
  const state =
    findings.length === 0
      ? "seeded_external_publication_admitted"
      : findings.some((finding) => blockingStates.has(finding.state))
        ? "seeded_external_publication_blocked"
        : "seeded_external_publication_incomplete";

  return {
    passed: state === "seeded_external_publication_admitted",
    state,
    receiptAdmitted:
      state === "seeded_external_publication_admitted" &&
      ordinaryReceiptResult.passed,
    externalEventObserved:
      state === "seeded_external_publication_admitted" &&
      ordinaryReceiptResult.eventObserved,
    evidenceClass: ordinaryReceiptResult.evidenceClass,
    eventKind: ordinaryReceiptResult.eventKind,
    syntheticQualificationOnly:
      ordinaryReceiptResult.syntheticQualificationOnly,
    publicRegistryPublished:
      state === "seeded_external_publication_admitted" &&
      ordinaryReceiptResult.publicRegistryPublished,
    publicReleaseOccurred:
      state === "seeded_external_publication_admitted" &&
      ordinaryReceiptResult.publicReleaseOccurred,
    seededPublicRegistryResult: registryResult,
    seededPublicRegistryResultDigest: registryResultDigest,
    registryEntryDigest,
    externalPublicationRequestDigest: externalRequestDigest,
    externalPublicationReceiptDigest: externalReceiptDigest,
    externalArtifactSetDigest: artifactSetDigest,
    publicationEnvelopeDigest: envelopeDigest,
    ordinaryReceiptResultDigest,
    ordinaryReceiptResult,
    findings,
    validationErrors: [],
    pullList: dedupe(findings.map((finding) => finding.requiredAction)),
    prohibitedTransitions: [
      ...COMMONS_SEEDED_EXTERNAL_PUBLICATION_PROHIBITED_TRANSITIONS,
    ],
  };
}
