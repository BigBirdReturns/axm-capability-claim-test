import type { GarpaValidationResult } from "../../types/garpa";
import type {
  CommonsSeededAsBuiltReceipt,
  CommonsSeededBuildReceiptRequest,
} from "../../types/garpaCommonsSeededBuildReceipt";
import { validateCommonsSeededBuildManifestRequest } from "./validateCommonsSeededBuildManifest";

const SHA256 = /^[a-f0-9]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function validDate(value: unknown): value is string {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmpty);
}

function nonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function unique(values: string[], path: string, errors: string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) errors.push(`${path} contains duplicate id "${value}".`);
    seen.add(value);
  }
}

function requireStrings(
  value: Record<string, unknown>,
  fields: string[],
  path: string,
  errors: string[],
): void {
  for (const field of fields) {
    if (!nonEmpty(value[field])) errors.push(`${path}.${field} is required.`);
  }
}

function validateArtifact(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(value, ["artifactId", "sha256", "mediaType", "path", "capturedAt"], path, errors);
  if (nonEmpty(value.sha256) && !SHA256.test(value.sha256)) {
    errors.push(`${path}.sha256 must be a SHA-256 hex digest.`);
  }
  if (nonEmpty(value.capturedAt) && !validDate(value.capturedAt)) {
    errors.push(`${path}.capturedAt must be a valid date-time.`);
  }
  return errors;
}

function validateInstalledComponent(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(
    value,
    [
      "componentId",
      "exactModelOrVersion",
      "configurationDigest",
      "supplierOrSource",
      "currency",
      "installedAt",
      "installedBy",
    ],
    path,
    errors,
  );
  if (!positive(value.quantity)) errors.push(`${path}.quantity must be positive.`);
  if (!nonNegative(value.actualUnitCost)) {
    errors.push(`${path}.actualUnitCost must be non-negative.`);
  }
  for (const field of [
    "serialOrLotIds",
    "acquisitionRecordIds",
    "evidenceArtifactIds",
  ]) {
    if (!stringArray(value[field])) errors.push(`${path}.${field} must be an array of strings.`);
  }
  if (nonEmpty(value.installedAt) && !validDate(value.installedAt)) {
    errors.push(`${path}.installedAt must be a valid date-time.`);
  }
  return errors;
}

function validateInstalledCode(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(
    value,
    [
      "customCodeId",
      "exactVersion",
      "sourceCommit",
      "packageDigest",
      "dependencyLockDigest",
      "configurationDigest",
      "installedAt",
      "installedBy",
    ],
    path,
    errors,
  );
  if (!stringArray(value.evidenceArtifactIds)) {
    errors.push(`${path}.evidenceArtifactIds must be an array of strings.`);
  }
  if (nonEmpty(value.installedAt) && !validDate(value.installedAt)) {
    errors.push(`${path}.installedAt must be a valid date-time.`);
  }
  return errors;
}

function validateCalibration(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(
    value,
    ["calibrationPlanId", "subjectId", "state", "executedAt", "executedBy"],
    path,
    errors,
  );
  if (!stringArray(value.evidenceArtifactIds)) {
    errors.push(`${path}.evidenceArtifactIds must be an array of strings.`);
  }
  if (!stringArray(value.notes)) errors.push(`${path}.notes must be an array of strings.`);
  if (!["passed", "failed", "inconclusive"].includes(String(value.state))) {
    errors.push(`${path}.state is invalid.`);
  }
  if (nonEmpty(value.executedAt) && !validDate(value.executedAt)) {
    errors.push(`${path}.executedAt must be a valid date-time.`);
  }
  return errors;
}

function validateAssembly(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(
    value,
    ["assemblyStepId", "state", "startedAt", "completedAt", "executedBy"],
    path,
    errors,
  );
  for (const field of [
    "componentIds",
    "customCodeIds",
    "compatibilityEdgeIds",
    "evidenceArtifactIds",
    "deviationIds",
    "notes",
  ]) {
    if (!stringArray(value[field])) errors.push(`${path}.${field} must be an array of strings.`);
  }
  if (!["passed", "failed", "skipped"].includes(String(value.state))) {
    errors.push(`${path}.state is invalid.`);
  }
  if (typeof value.rollbackPerformed !== "boolean") {
    errors.push(`${path}.rollbackPerformed must be boolean.`);
  }
  if (nonEmpty(value.startedAt) && !validDate(value.startedAt)) {
    errors.push(`${path}.startedAt must be a valid date-time.`);
  }
  if (nonEmpty(value.completedAt) && !validDate(value.completedAt)) {
    errors.push(`${path}.completedAt must be a valid date-time.`);
  }
  return errors;
}

function validateSubstitution(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(
    value,
    [
      "substitutionId",
      "originalComponentId",
      "replacementComponentId",
      "policy",
      "executedAt",
    ],
    path,
    errors,
  );
  for (const field of ["approvalReceiptIds", "regressionMetricIds", "evidenceArtifactIds"]) {
    if (!stringArray(value[field])) errors.push(`${path}.${field} must be an array of strings.`);
  }
  if (!["equivalent_with_retest", "architecture_review"].includes(String(value.policy))) {
    errors.push(`${path}.policy is invalid.`);
  }
  return errors;
}

function validateDeviation(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(value, ["deviationId", "description", "disposition"], path, errors);
  for (const field of [
    "affectedComponentIds",
    "affectedCustomCodeIds",
    "affectedCompatibilityEdgeIds",
    "approvalReceiptIds",
    "evidenceArtifactIds",
  ]) {
    if (!stringArray(value[field])) errors.push(`${path}.${field} must be an array of strings.`);
  }
  if (!["accepted", "reworked", "blocked"].includes(String(value.disposition))) {
    errors.push(`${path}.disposition is invalid.`);
  }
  return errors;
}

function validateCost(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(value, ["costLineId", "currency"], path, errors);
  if (!nonNegative(value.amount)) errors.push(`${path}.amount must be non-negative.`);
  if (!stringArray(value.evidenceArtifactIds)) {
    errors.push(`${path}.evidenceArtifactIds must be an array of strings.`);
  }
  return errors;
}

function validateLabor(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(value, ["laborId", "category", "actor"], path, errors);
  if (!nonNegative(value.hours)) errors.push(`${path}.hours must be non-negative.`);
  if (!stringArray(value.evidenceArtifactIds)) {
    errors.push(`${path}.evidenceArtifactIds must be an array of strings.`);
  }
  return errors;
}

function validateReceipt(value: unknown): GarpaValidationResult<CommonsSeededAsBuiltReceipt> {
  if (!isRecord(value)) return { ok: false, errors: ["asBuiltReceipt must be an object."] };
  const errors: string[] = [];
  if (value.schemaVersion !== 1) errors.push("asBuiltReceipt.schemaVersion must equal 1.");
  requireStrings(
    value,
    [
      "receiptId",
      "caseId",
      "seededBuildManifestResultDigest",
      "buildManifestDigest",
      "candidateArchitectureDigest",
      "qualificationContractDigest",
      "startedAt",
      "completedAt",
      "state",
      "receiptDigest",
    ],
    "asBuiltReceipt",
    errors,
  );
  for (const field of [
    "seededBuildManifestResultDigest",
    "buildManifestDigest",
    "candidateArchitectureDigest",
    "qualificationContractDigest",
    "receiptDigest",
  ]) {
    if (nonEmpty(value[field]) && !SHA256.test(value[field])) {
      errors.push(`asBuiltReceipt.${field} must be a SHA-256 hex digest.`);
    }
  }
  if (!validDate(value.startedAt)) errors.push("asBuiltReceipt.startedAt must be a valid date-time.");
  if (!validDate(value.completedAt)) errors.push("asBuiltReceipt.completedAt must be a valid date-time.");
  if (!["assembled", "blocked", "superseded"].includes(String(value.state))) {
    errors.push("asBuiltReceipt.state is invalid.");
  }
  if (value.qualificationTransferred !== false) {
    errors.push("asBuiltReceipt.qualificationTransferred must be false.");
  }
  if (value.missionEquivalenceClaimed !== false) {
    errors.push("asBuiltReceipt.missionEquivalenceClaimed must be false.");
  }

  const validators: Array<[string, (item: unknown, path: string) => string[]]> = [
    ["installedComponents", validateInstalledComponent],
    ["installedCustomCode", validateInstalledCode],
    ["calibrationReceipts", validateCalibration],
    ["assemblyStepReceipts", validateAssembly],
    ["substitutions", validateSubstitution],
    ["deviations", validateDeviation],
    ["actualCosts", validateCost],
    ["labor", validateLabor],
    ["artifacts", validateArtifact],
  ];
  for (const [field, validator] of validators) {
    if (!Array.isArray(value[field])) {
      errors.push(`asBuiltReceipt.${field} must be an array.`);
      continue;
    }
    value[field].forEach((item, index) => {
      errors.push(...validator(item, `asBuiltReceipt.${field}.${index}`));
    });
  }

  if (Array.isArray(value.installedComponents)) {
    unique(
      value.installedComponents
        .filter(isRecord)
        .map((item) => String(item.componentId)),
      "asBuiltReceipt.installedComponents",
      errors,
    );
  }
  if (Array.isArray(value.installedCustomCode)) {
    unique(
      value.installedCustomCode.filter(isRecord).map((item) => String(item.customCodeId)),
      "asBuiltReceipt.installedCustomCode",
      errors,
    );
  }
  if (Array.isArray(value.calibrationReceipts)) {
    unique(
      value.calibrationReceipts.filter(isRecord).map((item) => String(item.calibrationPlanId)),
      "asBuiltReceipt.calibrationReceipts",
      errors,
    );
  }
  if (Array.isArray(value.assemblyStepReceipts)) {
    unique(
      value.assemblyStepReceipts.filter(isRecord).map((item) => String(item.assemblyStepId)),
      "asBuiltReceipt.assemblyStepReceipts",
      errors,
    );
  }
  if (Array.isArray(value.artifacts)) {
    unique(
      value.artifacts.filter(isRecord).map((item) => String(item.artifactId)),
      "asBuiltReceipt.artifacts",
      errors,
    );
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, errors: [], value: value as unknown as CommonsSeededAsBuiltReceipt };
}

export function validateCommonsSeededBuildReceiptRequest(
  input: unknown,
): GarpaValidationResult<CommonsSeededBuildReceiptRequest> {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch (error) {
      return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
    }
  }
  if (!isRecord(value)) {
    return { ok: false, errors: ["Seeded build-receipt request must be an object."] };
  }

  const errors: string[] = [];
  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (!nonEmpty(value.expectedSeededBuildManifestResultDigest) ||
      !SHA256.test(value.expectedSeededBuildManifestResultDigest)) {
    errors.push("expectedSeededBuildManifestResultDigest must be a SHA-256 hex digest.");
  }
  if (!validDate(value.admittedAt)) errors.push("admittedAt must be a valid date-time.");

  const seeded = validateCommonsSeededBuildManifestRequest(
    value.seededBuildManifestRequest,
  );
  errors.push(...seeded.errors.map((error) => `seededBuildManifestRequest: ${error}`));

  const receipt = validateReceipt(value.asBuiltReceipt);
  errors.push(...receipt.errors);

  if (errors.length > 0 || !seeded.value || !receipt.value) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }

  return {
    ok: true,
    errors: [],
    value: {
      schemaVersion: 1,
      seededBuildManifestRequest: seeded.value,
      expectedSeededBuildManifestResultDigest:
        value.expectedSeededBuildManifestResultDigest as string,
      asBuiltReceipt: receipt.value,
      admittedAt: value.admittedAt as string,
    },
  };
}
