import type {
  ReleaseFileRecord,
  ReleaseVerificationFinding,
  ReleaseVerificationRequest,
  ReleaseVerificationResult,
  ReleaseVerificationState,
} from "../../types/garpaRelease";
import { isSafeReleasePath } from "./validateReleaseManifest";

function addFinding(
  findings: ReleaseVerificationFinding[],
  state: ReleaseVerificationFinding["state"],
  reason: string,
  path?: string,
): void {
  findings.push({ state, path, reason });
}

function duplicates(files: ReleaseFileRecord[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const file of files) {
    if (seen.has(file.path)) repeated.add(file.path);
    seen.add(file.path);
  }
  return [...repeated];
}

function registryState(
  request: ReleaseVerificationRequest,
  findings: ReleaseVerificationFinding[],
): Exclude<
  ReleaseVerificationState,
  | "manifest_digest_mismatch"
  | "file_missing"
  | "unexpected_file"
  | "file_digest_mismatch"
  | "file_length_mismatch"
  | "duplicate_path"
  | "unsafe_path"
  | "registry_mismatch"
> {
  const { manifest, registry } = request;
  if (!registry) {
    return manifest.state === "current"
      ? "current_valid"
      : manifest.state === "superseded"
        ? "superseded_valid"
        : "withdrawn_valid";
  }

  if (registry.caseId !== manifest.caseId) {
    addFinding(
      findings,
      "registry_mismatch",
      `Registry case ${registry.caseId} does not match manifest case ${manifest.caseId}.`,
    );
    return "superseded_valid";
  }

  if (registry.withdrawnReleaseIds.includes(manifest.releaseId)) {
    if (manifest.state !== "withdrawn") {
      addFinding(
        findings,
        "registry_mismatch",
        "Registry marks the release withdrawn while the manifest does not.",
      );
    }
    return "withdrawn_valid";
  }

  if (registry.currentReleaseId === manifest.releaseId) {
    if (
      registry.currentReleaseDigest &&
      registry.currentReleaseDigest !== manifest.manifestDigest
    ) {
      addFinding(
        findings,
        "registry_mismatch",
        "Registry current-release digest does not match the manifest digest.",
      );
    }
    if (manifest.state !== "current") {
      addFinding(
        findings,
        "registry_mismatch",
        "Registry marks the release current while the manifest state differs.",
      );
    }
    return "current_valid";
  }

  if (registry.supersededReleaseIds.includes(manifest.releaseId)) {
    if (manifest.state !== "superseded") {
      addFinding(
        findings,
        "registry_mismatch",
        "Registry marks the release superseded while the manifest does not.",
      );
    }
    return "superseded_valid";
  }

  addFinding(
    findings,
    "registry_mismatch",
    "Release identifier is not current, superseded, or withdrawn in the supplied registry.",
  );
  return "superseded_valid";
}

const FAILURE_PRIORITY: ReleaseVerificationFinding["state"][] = [
  "manifest_digest_mismatch",
  "unsafe_path",
  "duplicate_path",
  "file_missing",
  "unexpected_file",
  "file_digest_mismatch",
  "file_length_mismatch",
  "registry_mismatch",
];

export function verifyReleaseBundle(
  request: ReleaseVerificationRequest,
): ReleaseVerificationResult {
  const findings: ReleaseVerificationFinding[] = [];
  const { manifest, observedFiles } = request;

  if (request.computedManifestDigest !== manifest.manifestDigest) {
    addFinding(
      findings,
      "manifest_digest_mismatch",
      "Computed manifest digest does not match the release manifest.",
    );
  }

  for (const path of duplicates(manifest.files)) {
    addFinding(findings, "duplicate_path", "Manifest contains a duplicate path.", path);
  }
  for (const path of duplicates(observedFiles)) {
    addFinding(findings, "duplicate_path", "Observed bundle contains a duplicate path.", path);
  }
  for (const file of [...manifest.files, ...observedFiles]) {
    if (!isSafeReleasePath(file.path)) {
      addFinding(findings, "unsafe_path", "Release path is unsafe.", file.path);
    }
  }

  const expectedByPath = new Map(manifest.files.map((file) => [file.path, file]));
  const observedByPath = new Map(observedFiles.map((file) => [file.path, file]));

  for (const expected of manifest.files) {
    const observed = observedByPath.get(expected.path);
    if (!observed) {
      addFinding(findings, "file_missing", "Expected release file is absent.", expected.path);
      continue;
    }
    if (observed.sha256.toLowerCase() !== expected.sha256.toLowerCase()) {
      addFinding(
        findings,
        "file_digest_mismatch",
        "Observed file digest does not match the manifest.",
        expected.path,
      );
    }
    if (observed.byteLength !== expected.byteLength) {
      addFinding(
        findings,
        "file_length_mismatch",
        "Observed file length does not match the manifest.",
        expected.path,
      );
    }
  }

  for (const observed of observedFiles) {
    if (!expectedByPath.has(observed.path)) {
      addFinding(
        findings,
        "unexpected_file",
        "Observed bundle contains a file absent from the manifest.",
        observed.path,
      );
    }
  }

  const validState = registryState(request, findings);
  const firstFailure = FAILURE_PRIORITY.find((state) =>
    findings.some((finding) => finding.state === state),
  );

  return {
    passed: findings.length === 0,
    state: firstFailure ?? validState,
    releaseId: manifest.releaseId,
    caseId: manifest.caseId,
    findings,
    verifiedFileCount: manifest.files.filter((file) => {
      const observed = observedByPath.get(file.path);
      return (
        observed &&
        observed.sha256.toLowerCase() === file.sha256.toLowerCase() &&
        observed.byteLength === file.byteLength
      );
    }).length,
    releaseState: manifest.state,
  };
}
