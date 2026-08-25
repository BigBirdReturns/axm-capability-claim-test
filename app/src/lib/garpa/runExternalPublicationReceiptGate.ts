import type {
  ExternalPublicationReceiptFinding,
  ExternalPublicationReceiptRequest,
  ExternalPublicationReceiptResult,
} from "../../types/garpaExternalPublication";
import {
  computeExternalPublicationArtifactSetDigest,
  computeExternalPublicationReceiptDigest,
} from "./externalPublicationDigest";
import { sha256Hex } from "./sha256";
import { validateExternalPublicationReceiptRequest } from "./validateExternalPublicationReceipt";

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

function byteLength(content: string): number {
  return new TextEncoder().encode(content).byteLength;
}

function syntheticLocator(locator: string): boolean {
  return locator.startsWith("fixture://") || locator.startsWith("synthetic://");
}

function observedLocator(locator: string): boolean {
  return /^(https?:\/\/|ipfs:\/\/|s3:\/\/|gs:\/\/|urn:)/i.test(locator);
}

function addFinding(
  findings: ExternalPublicationReceiptFinding[],
  state: ExternalPublicationReceiptFinding["state"],
  reason: string,
  requiredAction: string,
  artifactId?: string,
): void {
  findings.push({ state, reason, requiredAction, artifactId });
}

function blockedValidationResult(
  request: unknown,
  errors: string[],
): ExternalPublicationReceiptResult {
  const record = request as Partial<ExternalPublicationReceiptRequest>;
  const receipt = record.receipt;
  return {
    passed: false,
    state: "external_publication_receipt_blocked",
    evidenceClass: receipt?.evidenceClass ?? "synthetic_qualification",
    eventKind: receipt?.eventKind ?? "registry_entry_published",
    eventObserved: false,
    syntheticQualificationOnly:
      receipt?.syntheticQualificationOnly ?? true,
    publicRegistryPublished: false,
    publicReleaseOccurred: false,
    receiptDigest: "",
    artifactSetDigest: "",
    artifactIds: [],
    findings: errors.map((reason) => ({
      state: "event_semantics_mismatch" as const,
      reason,
      requiredAction:
        "Repair the external-publication receipt request and rerun validation.",
    })),
    pullList: errors,
  };
}

export function runExternalPublicationReceiptGate(
  input: ExternalPublicationReceiptRequest | unknown,
): ExternalPublicationReceiptResult {
  const validated = validateExternalPublicationReceiptRequest(input);
  if (!validated.ok || !validated.value) {
    return blockedValidationResult(input, validated.errors);
  }

  const request = validated.value;
  const receipt = request.receipt;
  const findings: ExternalPublicationReceiptFinding[] = [];
  const receiptDigest = computeExternalPublicationReceiptDigest(receipt);
  const artifactSetDigest = computeExternalPublicationArtifactSetDigest(
    request.artifacts,
  );

  if (receipt.receiptDigest !== receiptDigest) {
    addFinding(
      findings,
      "receipt_digest_mismatch",
      "The external-publication receipt digest does not match its canonical content.",
      "Restore the immutable receipt content and recompute its canonical digest.",
    );
  }

  const artifactIds = request.artifacts.map((artifact) => artifact.artifactId);
  if (!exactSet(receipt.artifactIds, artifactIds)) {
    addFinding(
      findings,
      "artifact_set_mismatch",
      "The receipt artifact ledger omits captured evidence or references an absent artifact.",
      "Bind the complete exact capture-artifact set into the receipt.",
    );
  }

  for (const artifact of request.artifacts) {
    const computedDigest = sha256Hex(artifact.content);
    const computedLength = byteLength(artifact.content);
    if (artifact.sha256 !== computedDigest) {
      addFinding(
        findings,
        "artifact_digest_invalid",
        `Artifact ${artifact.artifactId} does not match its claimed SHA-256 digest.`,
        "Recompute the digest from the exact captured UTF-8 bytes.",
        artifact.artifactId,
      );
    }
    if (artifact.byteLength !== computedLength) {
      addFinding(
        findings,
        "artifact_length_invalid",
        `Artifact ${artifact.artifactId} does not match its claimed UTF-8 byte length.`,
        "Recompute the byte length from the exact captured UTF-8 bytes.",
        artifact.artifactId,
      );
    }
    if (artifact.sourceLocator !== receipt.sourceLocator) {
      addFinding(
        findings,
        "artifact_locator_mismatch",
        `Artifact ${artifact.artifactId} was captured from a different locator than the receipt.`,
        "Capture every receipt artifact from the exact governed locator.",
        artifact.artifactId,
      );
    }
    if (
      Date.parse(artifact.capturedAt) < Date.parse(receipt.publishedAt) ||
      Date.parse(artifact.capturedAt) > Date.parse(receipt.observedAt)
    ) {
      addFinding(
        findings,
        "artifact_time_order_invalid",
        `Artifact ${artifact.artifactId} was captured outside the publication observation window.`,
        "Restore chronology across publication, capture, observation, and receipt admission.",
        artifact.artifactId,
      );
    }
  }

  if (
    Date.parse(receipt.observedAt) < Date.parse(receipt.publishedAt) ||
    Date.parse(request.admittedAt) < Date.parse(receipt.observedAt)
  ) {
    addFinding(
      findings,
      "publication_time_order_invalid",
      "Observation predates publication or receipt admission predates observation.",
      "Restore chronology across publication, observation, and receipt admission.",
    );
  }

  const expectedTarget =
    receipt.eventKind === "registry_entry_published"
      ? receipt.registryEntryDigest
      : receipt.releaseBundleDigest;
  if (receipt.targetContentDigest !== expectedTarget) {
    addFinding(
      findings,
      "target_content_digest_mismatch",
      "The receipt target digest does not identify the governed registry entry or release bundle for its event kind.",
      "Bind the event to the exact target content digest.",
    );
  }

  const locatorIsSynthetic = syntheticLocator(receipt.sourceLocator);
  if (receipt.evidenceClass === "synthetic_qualification") {
    if (!receipt.syntheticQualificationOnly) {
      addFinding(
        findings,
        "event_semantics_mismatch",
        "Synthetic qualification evidence must remain explicitly qualification-only.",
        "Set syntheticQualificationOnly to true.",
      );
    }
    if (receipt.publicRegistryPublished || receipt.publicReleaseOccurred) {
      addFinding(
        findings,
        "synthetic_occurrence_attempted",
        "Synthetic qualification evidence attempts to assert a real external publication or distribution event.",
        "Keep all real-world occurrence flags false for synthetic qualification evidence.",
      );
    }
    if (!locatorIsSynthetic) {
      addFinding(
        findings,
        "synthetic_locator_invalid",
        "Synthetic qualification evidence must use a fixture:// or synthetic:// locator.",
        "Use a visibly synthetic locator that cannot be confused with an observed external venue.",
      );
    }
  } else {
    if (receipt.syntheticQualificationOnly) {
      addFinding(
        findings,
        "event_semantics_mismatch",
        "Observed external evidence cannot be marked qualification-only.",
        "Set syntheticQualificationOnly to false for an observed external event.",
      );
    }
    if (locatorIsSynthetic || !observedLocator(receipt.sourceLocator)) {
      addFinding(
        findings,
        "observed_locator_invalid",
        "Observed external evidence requires an external URI and cannot use a fixture:// or synthetic:// locator.",
        "Supply the exact observed http, https, ipfs, object-store, or URN locator.",
      );
    }
    const registryEvent = receipt.eventKind === "registry_entry_published";
    const expectedRegistryPublished = registryEvent;
    const expectedReleaseOccurred = !registryEvent;
    if (
      receipt.publicRegistryPublished !== expectedRegistryPublished ||
      receipt.publicReleaseOccurred !== expectedReleaseOccurred
    ) {
      addFinding(
        findings,
        "observed_occurrence_missing",
        "Observed external evidence does not carry the exact event-specific occurrence flags.",
        "Assert only the occurrence proved by the exact observed event kind.",
      );
    }
  }

  const passed = findings.length === 0;
  const eventObserved =
    passed && receipt.evidenceClass === "observed_external";
  return {
    passed,
    state: passed
      ? "external_publication_receipt_admitted"
      : "external_publication_receipt_blocked",
    evidenceClass: receipt.evidenceClass,
    eventKind: receipt.eventKind,
    eventObserved,
    syntheticQualificationOnly: receipt.syntheticQualificationOnly,
    publicRegistryPublished:
      eventObserved && receipt.publicRegistryPublished,
    publicReleaseOccurred:
      eventObserved && receipt.publicReleaseOccurred,
    receiptDigest,
    artifactSetDigest,
    artifactIds: sorted(artifactIds),
    findings,
    pullList: dedupe(findings.map((finding) => finding.requiredAction)),
  };
}
