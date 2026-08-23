import type {
  GarpaReleaseManifest,
  ReleaseVerificationInput,
  ReleaseVerificationResult,
} from "../../types/garpaRelease";

const REQUIRED_RELEASE_PATHS = [
  "release.json",
  "README.md",
  "reality-brief.md",
  "public-dossier.md",
  "claims/publication-claims.json",
  "claims/support-graph.json",
  "receipts/publication-gate.json",
] as const;

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate];
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function validateReleaseManifestShape(
  manifest: GarpaReleaseManifest,
): string[] {
  const errors: string[] = [];
  if (manifest.schemaVersion !== 1) errors.push("release schemaVersion must be 1");
  if (!manifest.releaseId.trim()) errors.push("releaseId is required");
  if (!manifest.caseId.trim()) errors.push("caseId is required");
  if (!Number.isInteger(manifest.releaseNumber) || manifest.releaseNumber < 1) {
    errors.push("releaseNumber must be a positive integer");
  }
  if (!manifest.publicationPackageDigest.trim()) {
    errors.push("publicationPackageDigest is required");
  }
  if (!manifest.publicationGateReceiptDigest.trim()) {
    errors.push("publicationGateReceiptDigest is required");
  }
  if (!manifest.manifestDigest.trim()) errors.push("manifestDigest is required");

  for (const file of manifest.files) {
    const normalized = normalizePath(file.path);
    if (!normalized || normalized.startsWith("../") || normalized.includes("/../")) {
      errors.push(`release file path is unsafe: ${file.path}`);
    }
    if (!/^[a-f0-9]{64}$/i.test(file.sha256)) {
      errors.push(`release file ${file.path} has an invalid SHA-256 digest`);
    }
    if (!Number.isInteger(file.byteLength) || file.byteLength < 0) {
      errors.push(`release file ${file.path} has an invalid byteLength`);
    }
  }

  const paths = manifest.files.map((file) => normalizePath(file.path));
  for (const path of duplicates(paths)) errors.push(`release manifest repeats path ${path}`);
  for (const requiredPath of REQUIRED_RELEASE_PATHS) {
    const entry = manifest.files.find(
      (file) => normalizePath(file.path) === requiredPath,
    );
    if (!entry || !entry.required) {
      errors.push(`required release path is absent or not marked required: ${requiredPath}`);
    }
  }

  return errors;
}

export function verifyReleaseManifest(
  input: ReleaseVerificationInput,
): ReleaseVerificationResult {
  const { manifest, actualFiles, publicationGate } = input;
  const shapeErrors = validateReleaseManifestShape(manifest);
  const manifestPaths = manifest.files.map((file) => normalizePath(file.path));
  const duplicateManifestPaths = duplicates(manifestPaths);
  const actualPaths = Object.keys(actualFiles).map(normalizePath);
  const missingFiles: string[] = [];
  const hashMismatches: string[] = [];
  const lengthMismatches: string[] = [];

  for (const entry of manifest.files) {
    const path = normalizePath(entry.path);
    const actual = actualFiles[path];
    if (!actual) {
      if (entry.required) missingFiles.push(path);
      continue;
    }
    if (actual.sha256.toLowerCase() !== entry.sha256.toLowerCase()) {
      hashMismatches.push(path);
    }
    if (actual.byteLength !== entry.byteLength) {
      lengthMismatches.push(path);
    }
  }

  const manifestPathSet = new Set(manifestPaths);
  const unexpectedFiles = actualPaths.filter((path) => !manifestPathSet.has(path));
  const publicationAdmitted = publicationGate.passed;
  const blockingReasons = [
    ...shapeErrors,
    ...missingFiles.map((path) => `required release file is missing: ${path}`),
    ...hashMismatches.map((path) => `release file hash mismatch: ${path}`),
    ...lengthMismatches.map((path) => `release file length mismatch: ${path}`),
    ...unexpectedFiles.map((path) => `release contains an unmanifested file: ${path}`),
  ];
  if (!publicationAdmitted) {
    blockingReasons.push("publication gate did not pass");
  }

  return {
    passed: blockingReasons.length === 0,
    releaseId: manifest.releaseId,
    publicationAdmitted,
    missingFiles,
    unexpectedFiles,
    hashMismatches,
    lengthMismatches,
    duplicateManifestPaths,
    blockingReasons,
  };
}
