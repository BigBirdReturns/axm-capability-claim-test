import type {
  ActualReleaseFile,
  ReleaseFileRecord,
  ReleaseVerificationResult,
} from "../../types/garpaRelease";
import type {
  CommonsSeededReleaseFinding,
  CommonsSeededReleaseRequest,
  CommonsSeededReleaseResult,
} from "../../types/garpaCommonsSeededRelease";
import { canonicalStringify } from "./canonicalJson";
import {
  canonicalReleaseFilePayloads,
  canonicalReleaseFileRecords,
  computeCommonsSeededReleaseBundleDigest,
  computeCommonsSeededReleaseEnvelopeDigest,
  computeCommonsSeededReleaseFileSetDigest,
  computeCommonsSeededReleaseManifestDigest,
  computeReleaseFileContentDigest,
  computeUtf8ByteLength,
  releaseFileRecord,
} from "./commonsSeededReleaseDigest";
import { computeCommonsSeededPublicationResultDigest } from "./commonsSeededPublicationDigest";
import {
  deriveCommonsSeededReleaseFiles,
  deriveCommonsSeededReleaseManifest,
} from "./deriveCommonsSeededRelease";
import { runCommonsSeededPublicationGate } from "./runCommonsSeededPublicationGate";
import { validateReleaseManifestShape, verifyReleaseManifest } from "./verifyReleaseManifest";
import { verifyReleaseBundle } from "./verifyReleaseBundle";
import { validateCommonsSeededReleaseRequest } from "./validateCommonsSeededRelease";

export const COMMONS_SEEDED_RELEASE_PROHIBITED_TRANSITIONS = [
  "Release verification establishes the integrity of one exact candidate bundle; it does not mean that public release, registry update, deployment, or unrestricted equivalence has occurred.",
  "Only a Commons publication record whose existing publication gate returned publication_ready may enter release verification.",
  "Every required public surface, failure and residual register, upstream receipt, rights record, safety record, redaction record, and evidence ledger remains immutable under the verified manifest.",
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
  findings: CommonsSeededReleaseFinding[],
  state: CommonsSeededReleaseFinding["state"],
  reason: string,
  requiredAction: string,
  path?: string,
): void {
  findings.push({ state, reason, requiredAction, path });
}

function blockedResult(errors: string[]): CommonsSeededReleaseResult {
  return {
    passed: false,
    state: "seeded_release_blocked",
    releaseVerified: false,
    seededPublicationResultDigest: "",
    releaseManifestDigest: "",
    releaseEnvelopeDigest: "",
    fileSetDigest: "",
    bundleDigest: "",
    expectedFiles: [],
    releaseFiles: [],
    findings: errors.map((reason) => ({
      state: "release_validation_failed" as const,
      reason,
      requiredAction:
        "Repair the Commons-seeded release request and rerun validation.",
    })),
    validationErrors: errors,
    pullList: errors,
    prohibitedTransitions: [...COMMONS_SEEDED_RELEASE_PROHIBITED_TRANSITIONS],
  };
}

function actualFiles(
  request: CommonsSeededReleaseRequest,
): Record<string, ActualReleaseFile> {
  return Object.fromEntries(
    request.releaseFiles.map((file) => [
      file.path,
      { sha256: file.sha256, byteLength: file.byteLength },
    ]),
  );
}

function observedFiles(
  request: CommonsSeededReleaseRequest,
): ReleaseFileRecord[] {
  return request.releaseFiles.map(releaseFileRecord);
}

export function runCommonsSeededReleaseGate(
  input: CommonsSeededReleaseRequest | unknown,
): CommonsSeededReleaseResult {
  const validated = validateCommonsSeededReleaseRequest(input);
  if (!validated.ok || !validated.value) return blockedResult(validated.errors);

  const request = validated.value;
  const findings: CommonsSeededReleaseFinding[] = [];
  const publicationResult = runCommonsSeededPublicationGate(
    request.seededPublicationRequest,
  );
  const publicationResultDigest =
    computeCommonsSeededPublicationResultDigest(publicationResult);
  const manifest = request.releaseManifest;
  const envelope = request.releaseEnvelope;
  const manifestDigest =
    computeCommonsSeededReleaseManifestDigest(manifest);
  const envelopeDigest =
    computeCommonsSeededReleaseEnvelopeDigest(envelope);
  const fileSetDigest =
    computeCommonsSeededReleaseFileSetDigest(request.releaseFiles);
  const bundleDigest =
    computeCommonsSeededReleaseBundleDigest(request.releaseFiles);

  if (
    request.expectedSeededPublicationResultDigest !== publicationResultDigest ||
    envelope.seededPublicationResultDigest !== publicationResultDigest
  ) {
    addFinding(
      findings,
      "publication_result_mismatch",
      "The expected or enveloped Commons-seeded publication result digest does not match deterministic recomputation.",
      "Refresh the exact admitted publication result before constructing release files.",
    );
  }
  if (!publicationResult.passed || !publicationResult.publicationPackage) {
    addFinding(
      findings,
      "publication_record_not_admitted",
      "The governing Commons-seeded publication record is not admitted.",
      "Resolve publication custody before release construction.",
    );
  }
  if (
    !publicationResult.publicationReady ||
    publicationResult.publicationState !== "publication_ready" ||
    !publicationResult.ordinaryPublicationGate?.passed
  ) {
    addFinding(
      findings,
      "publication_not_ready",
      "The existing publication gate has not admitted this package for publication.",
      "Resolve every ordinary publication finding before release construction.",
    );
  }

  const identity = {
    releaseId: manifest.releaseId,
    releaseNumber: 1 as const,
    state: "current" as const,
    createdAt: manifest.createdAt,
  };
  const expectedFiles = publicationResult.publicationPackage
    ? deriveCommonsSeededReleaseFiles(
        request.seededPublicationRequest,
        publicationResult,
        identity,
      )
    : [];
  const expectedManifest = publicationResult.publicationPackage
    ? deriveCommonsSeededReleaseManifest(
        request.seededPublicationRequest,
        publicationResult,
        identity,
        expectedFiles,
      )
    : manifest;

  if (manifest.manifestDigest !== manifestDigest) {
    addFinding(
      findings,
      "release_manifest_digest_mismatch",
      "The release-manifest digest does not match its canonical content.",
      "Restore the immutable manifest and recompute its canonical digest.",
    );
  }
  if (envelope.envelopeDigest !== envelopeDigest) {
    addFinding(
      findings,
      "release_envelope_digest_mismatch",
      "The release-envelope digest does not match its canonical content.",
      "Restore the immutable release envelope and recompute its digest.",
    );
  }
  if (
    manifest.caseId !== publicationResult.publicationPackage?.caseId ||
    envelope.caseId !== manifest.caseId ||
    envelope.releaseId !== manifest.releaseId ||
    envelope.releaseNumber !== manifest.releaseNumber ||
    envelope.releaseState !== manifest.state
  ) {
    addFinding(
      findings,
      "release_case_mismatch",
      "The release manifest, envelope, and admitted publication package do not identify the same release and case.",
      "Build the release for the exact admitted case and release identity.",
    );
  }
  if (
    manifest.publicationPackageDigest !==
      publicationResult.publicationPackageDigest ||
    manifest.publicationGateReceiptDigest !==
      publicationResult.ordinaryPublicationGateResultDigest ||
    envelope.caseIndexDigest !==
      publicationResult.publicationPackage?.caseIndexDigest ||
    envelope.publicationPackageDigest !==
      publicationResult.publicationPackageDigest ||
    envelope.publicationGateResultDigest !==
      publicationResult.ordinaryPublicationGateResultDigest
  ) {
    addFinding(
      findings,
      "release_upstream_digest_mismatch",
      "The release is not bound to the exact publication package, publication-gate receipt, and current case index.",
      "Regenerate the bundle from the exact publication-ready result.",
    );
  }
  if (
    manifest.releaseNumber !== 1 ||
    manifest.state !== "current" ||
    manifest.priorReleaseDigest !== undefined ||
    manifest.supersedesReleaseId !== undefined
  ) {
    addFinding(
      findings,
      "release_lineage_invalid",
      "Version 1 Commons release verification admits only an initial current R1 without invented prior or superseded lineage.",
      "Use R1 current for the first release; route later lineage through a separately custodied supersession stage.",
    );
  }
  if (
    Date.parse(manifest.createdAt) <
      Date.parse(request.seededPublicationRequest.admittedAt) ||
    Date.parse(envelope.verifiedAt) < Date.parse(manifest.createdAt) ||
    Date.parse(request.admittedAt) < Date.parse(envelope.verifiedAt)
  ) {
    addFinding(
      findings,
      "release_time_order_invalid",
      "Release creation predates publication admission, verification predates creation, or request admission predates verification.",
      "Restore chronology across publication admission, bundle creation, verification, and release-record admission.",
    );
  }

  const expectedByPath = new Map(expectedFiles.map((file) => [file.path, file]));
  const actualByPath = new Map(
    request.releaseFiles.map((file) => [file.path, file]),
  );
  if (!exactSet([...expectedByPath.keys()], [...actualByPath.keys()])) {
    addFinding(
      findings,
      "release_file_set_mismatch",
      "The submitted release bundle omits required generated files or contains ungoverned files.",
      "Restore the exact deterministic file set without additions or omissions.",
    );
  }
  for (const [path, actual] of actualByPath) {
    const expected = expectedByPath.get(path);
    const recomputedDigest = computeReleaseFileContentDigest(actual.content);
    const recomputedLength = computeUtf8ByteLength(actual.content);
    if (actual.sha256 !== recomputedDigest) {
      addFinding(
        findings,
        "release_file_digest_mismatch",
        `Release file ${path} carries a digest that does not match its UTF-8 content.`,
        "Recompute the exact SHA-256 digest from the submitted bytes.",
        path,
      );
    }
    if (actual.byteLength !== recomputedLength) {
      addFinding(
        findings,
        "release_file_length_mismatch",
        `Release file ${path} carries a byte length that does not match its UTF-8 content.`,
        "Recompute the exact UTF-8 byte length.",
        path,
      );
    }
    if (!expected) continue;
    if (actual.content !== expected.content) {
      addFinding(
        findings,
        "release_file_content_mismatch",
        `Release file ${path} differs from deterministic publication output.`,
        "Regenerate the file from the exact admitted publication result.",
        path,
      );
    }
    if (
      actual.mediaType !== expected.mediaType ||
      actual.role !== expected.role ||
      actual.required !== expected.required ||
      actual.contentEncoding !== expected.contentEncoding
    ) {
      addFinding(
        findings,
        "release_file_metadata_mismatch",
        `Release file ${path} changes its media type, role, required state, or encoding.`,
        "Restore the exact deterministic file metadata.",
        path,
      );
    }
  }
  if (
    canonicalStringify(
      canonicalReleaseFileRecords(manifest.files),
    ) !==
      canonicalStringify(
        canonicalReleaseFileRecords(expectedManifest.files),
      ) ||
    manifest.manifestDigest !== expectedManifest.manifestDigest ||
    envelope.releaseManifestDigest !== expectedManifest.manifestDigest ||
    envelope.fileSetDigest !==
      computeCommonsSeededReleaseFileSetDigest(expectedFiles) ||
    envelope.bundleDigest !==
      computeCommonsSeededReleaseBundleDigest(expectedFiles)
  ) {
    addFinding(
      findings,
      "release_file_set_mismatch",
      "The manifest or release envelope does not describe the exact deterministic file records and bundle digests.",
      "Rebuild the manifest and envelope from the generated file payloads.",
    );
  }
  for (const error of validateReleaseManifestShape(manifest)) {
    if (error.includes("unsafe")) {
      addFinding(
        findings,
        "release_path_unsafe",
        error,
        "Use normalized relative release paths only.",
      );
    }
  }
  if (envelope.unrestrictedEquivalenceClaimed !== false) {
    addFinding(
      findings,
      "unrestricted_equivalence_attempted",
      "The release envelope attempts to claim unrestricted product equivalence.",
      "Keep unrestricted equivalence structurally false.",
    );
  }
  if (envelope.deploymentAuthorityClaimed !== false) {
    addFinding(
      findings,
      "deployment_authority_attempted",
      "The release envelope attempts to authorize deployment.",
      "Keep deployment authority under the existing safety controls.",
    );
  }
  if (envelope.registryUpdated !== false) {
    addFinding(
      findings,
      "registry_update_attempted",
      "The release envelope claims that the public registry was updated before registry admission.",
      "Keep registryUpdated false until the registry gate admits the exact release.",
    );
  }
  if (envelope.publicReleaseOccurred !== false) {
    addFinding(
      findings,
      "public_release_attempted",
      "The release envelope claims that public release already occurred.",
      "Keep public release false until verified release and registry controls complete.",
    );
  }

  const blockingStates = new Set<CommonsSeededReleaseFinding["state"]>([
    "release_validation_failed",
    "publication_result_mismatch",
    "publication_record_not_admitted",
    "publication_not_ready",
    "release_manifest_digest_mismatch",
    "release_envelope_digest_mismatch",
    "release_case_mismatch",
    "release_upstream_digest_mismatch",
    "release_time_order_invalid",
    "release_lineage_invalid",
    "release_file_set_mismatch",
    "release_file_content_mismatch",
    "release_file_digest_mismatch",
    "release_file_length_mismatch",
    "release_file_metadata_mismatch",
    "release_path_unsafe",
    "ordinary_release_manifest_verification_failed",
    "ordinary_release_bundle_verification_failed",
    "unrestricted_equivalence_attempted",
    "deployment_authority_attempted",
    "registry_update_attempted",
    "public_release_attempted",
  ]);

  let manifestVerification: ReleaseVerificationResult | undefined;
  let bundleVerification: ReleaseVerificationResult | undefined;
  if (
    publicationResult.ordinaryPublicationGate &&
    !findings.some((finding) => blockingStates.has(finding.state))
  ) {
    manifestVerification = verifyReleaseManifest({
      manifest,
      actualFiles: actualFiles(request),
      publicationGate: publicationResult.ordinaryPublicationGate,
    });
    if (!manifestVerification.passed) {
      addFinding(
        findings,
        "ordinary_release_manifest_verification_failed",
        `The existing release-manifest verifier refused the bundle: ${(manifestVerification.blockingReasons ?? []).join("; ")}.`,
        "Resolve every required path, file, hash, length, and publication-gate finding.",
      );
    }
    bundleVerification = verifyReleaseBundle({
      manifest,
      computedManifestDigest: manifestDigest,
      observedFiles: observedFiles(request),
    });
    if (!bundleVerification.passed) {
      addFinding(
        findings,
        "ordinary_release_bundle_verification_failed",
        `The existing release-bundle verifier returned ${bundleVerification.state}.`,
        "Resolve every manifest, path, file, digest, length, and registry finding.",
      );
    }
  }

  const state =
    findings.length === 0
      ? "seeded_release_admitted"
      : findings.some((finding) => blockingStates.has(finding.state))
        ? "seeded_release_blocked"
        : "seeded_release_incomplete";

  return {
    passed: state === "seeded_release_admitted",
    state,
    releaseVerified:
      Boolean(manifestVerification?.passed) &&
      Boolean(bundleVerification?.passed),
    releaseState: bundleVerification?.state,
    seededPublicationResult: publicationResult,
    seededPublicationResultDigest: publicationResultDigest,
    releaseManifestDigest: manifestDigest,
    releaseEnvelopeDigest: envelopeDigest,
    fileSetDigest,
    bundleDigest,
    ordinaryManifestVerification: manifestVerification,
    ordinaryBundleVerification: bundleVerification,
    releaseManifest: manifest,
    expectedFiles,
    releaseFiles: request.releaseFiles,
    findings,
    validationErrors: [],
    pullList: dedupe(findings.map((finding) => finding.requiredAction)),
    prohibitedTransitions: [...COMMONS_SEEDED_RELEASE_PROHIBITED_TRANSITIONS],
  };
}
