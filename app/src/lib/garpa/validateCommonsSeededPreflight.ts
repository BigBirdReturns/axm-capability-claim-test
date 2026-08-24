import type { GarpaValidationResult } from "../../types/garpa";
import type {
  CommonsSeededPreflightReceipt,
  CommonsSeededPreflightRequest,
} from "../../types/garpaCommonsSeededPreflight";
import { validateCommonsSeededBuildReceiptRequest } from "./validateCommonsSeededBuildReceipt";

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

function unique(values: string[], path: string, errors: string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) errors.push(`${path} contains duplicate id "${value}".`);
    seen.add(value);
  }
}

function validateEvidence(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(value, ["evidenceId", "sha256", "path", "capturedAt"], path, errors);
  if (nonEmpty(value.sha256) && !SHA256.test(value.sha256)) {
    errors.push(`${path}.sha256 must be a SHA-256 hex digest.`);
  }
  if (nonEmpty(value.capturedAt) && !validDate(value.capturedAt)) {
    errors.push(`${path}.capturedAt must be a valid date-time.`);
  }
  return errors;
}

function validateFixture(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(
    value,
    ["fixtureId", "configurationDigest", "state", "verifiedAt", "verifiedBy"],
    path,
    errors,
  );
  if (!stringArray(value.evidenceIds)) errors.push(`${path}.evidenceIds must be an array of strings.`);
  if (!["ready", "blocked", "unknown"].includes(String(value.state))) {
    errors.push(`${path}.state is invalid.`);
  }
  if (nonEmpty(value.verifiedAt) && !validDate(value.verifiedAt)) {
    errors.push(`${path}.verifiedAt must be a valid date-time.`);
  }
  return errors;
}

function validateInstrument(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(
    value,
    [
      "instrumentationId",
      "exactModelOrVersion",
      "configurationDigest",
      "calibrationState",
      "storagePath",
      "state",
    ],
    path,
    errors,
  );
  for (const field of ["calibrationEvidenceIds", "evidenceIds"]) {
    if (!stringArray(value[field])) errors.push(`${path}.${field} must be an array of strings.`);
  }
  if (!["current", "not_required", "expired", "unknown"].includes(String(value.calibrationState))) {
    errors.push(`${path}.calibrationState is invalid.`);
  }
  if (!["ready", "blocked", "unknown"].includes(String(value.state))) {
    errors.push(`${path}.state is invalid.`);
  }
  if (typeof value.storageVerified !== "boolean") {
    errors.push(`${path}.storageVerified must be boolean.`);
  }
  return errors;
}

function validateOperator(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(value, ["humanRoleId", "actor", "state"], path, errors);
  for (const field of ["trainingEvidenceIds", "responsibilitiesAcknowledged"]) {
    if (!stringArray(value[field])) errors.push(`${path}.${field} must be an array of strings.`);
  }
  if (typeof value.authorityBoundaryAcknowledged !== "boolean") {
    errors.push(`${path}.authorityBoundaryAcknowledged must be boolean.`);
  }
  if (!["ready", "blocked", "unknown"].includes(String(value.state))) {
    errors.push(`${path}.state is invalid.`);
  }
  return errors;
}

function validateAuthorization(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(value, ["authorizationId", "state"], path, errors);
  for (const field of [
    "authorityRefs",
    "permittedActivities",
    "prohibitedActivities",
    "evidenceIds",
  ]) {
    if (!stringArray(value[field])) errors.push(`${path}.${field} must be an array of strings.`);
  }
  if (!["satisfied", "not_required", "missing", "expired"].includes(String(value.state))) {
    errors.push(`${path}.state is invalid.`);
  }
  return errors;
}

function validateHazard(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(value, ["hazardId", "description", "control", "owner", "state"], path, errors);
  if (!stringArray(value.evidenceIds)) errors.push(`${path}.evidenceIds must be an array of strings.`);
  if (!["controlled", "open", "not_applicable"].includes(String(value.state))) {
    errors.push(`${path}.state is invalid.`);
  }
  return errors;
}

function validateClock(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(
    value,
    [
      "clockPolicy",
      "clockSource",
      "maximumAllowedSkew",
      "measuredSkew",
      "state",
    ],
    path,
    errors,
  );
  for (const field of ["synchronizedInstrumentationIds", "evidenceIds"]) {
    if (!stringArray(value[field])) errors.push(`${path}.${field} must be an array of strings.`);
  }
  if (!["ready", "blocked", "unknown"].includes(String(value.state))) {
    errors.push(`${path}.state is invalid.`);
  }
  return errors;
}

function validateStorage(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(value, ["retentionPolicy", "capacityCheck", "state"], path, errors);
  for (const field of ["requiredPaths", "verifiedPaths", "evidenceIds"]) {
    if (!stringArray(value[field])) errors.push(`${path}.${field} must be an array of strings.`);
  }
  if (typeof value.writable !== "boolean") errors.push(`${path}.writable must be boolean.`);
  if (!["ready", "blocked", "unknown"].includes(String(value.state))) {
    errors.push(`${path}.state is invalid.`);
  }
  return errors;
}

function validateAbort(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(value, ["mechanism", "testMethod", "testedAt", "state"], path, errors);
  for (const field of ["authorityActors", "evidenceIds"]) {
    if (!stringArray(value[field])) errors.push(`${path}.${field} must be an array of strings.`);
  }
  if (nonEmpty(value.testedAt) && !validDate(value.testedAt)) {
    errors.push(`${path}.testedAt must be a valid date-time.`);
  }
  if (!["ready", "blocked", "unknown"].includes(String(value.state))) {
    errors.push(`${path}.state is invalid.`);
  }
  return errors;
}

function validateReservation(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  requireStrings(
    value,
    ["runId", "scenarioId", "reservedAt", "reservationReceiptId"],
    path,
    errors,
  );
  if (!stringArray(value.uniquenessEvidenceIds)) {
    errors.push(`${path}.uniquenessEvidenceIds must be an array of strings.`);
  }
  if (nonEmpty(value.reservedAt) && !validDate(value.reservedAt)) {
    errors.push(`${path}.reservedAt must be a valid date-time.`);
  }
  return errors;
}

function validateReceipt(value: unknown): GarpaValidationResult<CommonsSeededPreflightReceipt> {
  if (!isRecord(value)) return { ok: false, errors: ["preflightReceipt must be an object."] };
  const errors: string[] = [];
  if (value.schemaVersion !== 1) errors.push("preflightReceipt.schemaVersion must equal 1.");
  requireStrings(
    value,
    [
      "receiptId",
      "caseId",
      "seededBuildReceiptResultDigest",
      "asBuiltReceiptDigest",
      "buildManifestDigest",
      "qualificationContractDigest",
      "preflightAt",
      "state",
      "receiptDigest",
    ],
    "preflightReceipt",
    errors,
  );
  for (const field of [
    "seededBuildReceiptResultDigest",
    "asBuiltReceiptDigest",
    "buildManifestDigest",
    "qualificationContractDigest",
    "receiptDigest",
  ]) {
    if (nonEmpty(value[field]) && !SHA256.test(value[field])) {
      errors.push(`preflightReceipt.${field} must be a SHA-256 hex digest.`);
    }
  }
  if (!validDate(value.preflightAt)) errors.push("preflightReceipt.preflightAt must be a valid date-time.");
  if (!["ready", "blocked", "superseded"].includes(String(value.state))) {
    errors.push("preflightReceipt.state is invalid.");
  }
  if (value.qualificationTransferred !== false) {
    errors.push("preflightReceipt.qualificationTransferred must be false.");
  }
  if (value.missionEquivalenceClaimed !== false) {
    errors.push("preflightReceipt.missionEquivalenceClaimed must be false.");
  }

  const validators: Array<[string, (item: unknown, path: string) => string[]]> = [
    ["fixtureChecks", validateFixture],
    ["instrumentationChecks", validateInstrument],
    ["operatorChecks", validateOperator],
    ["authorizationChecks", validateAuthorization],
    ["hazardControls", validateHazard],
    ["runReservations", validateReservation],
    ["evidence", validateEvidence],
  ];
  for (const [field, validator] of validators) {
    if (!Array.isArray(value[field])) {
      errors.push(`preflightReceipt.${field} must be an array.`);
      continue;
    }
    value[field].forEach((item, index) => {
      errors.push(...validator(item, `preflightReceipt.${field}.${index}`));
    });
  }
  errors.push(...validateClock(value.clockCheck, "preflightReceipt.clockCheck"));
  errors.push(...validateStorage(value.storageCheck, "preflightReceipt.storageCheck"));
  errors.push(...validateAbort(value.abortCheck, "preflightReceipt.abortCheck"));

  for (const [field, id] of [
    ["fixtureChecks", "fixtureId"],
    ["instrumentationChecks", "instrumentationId"],
    ["operatorChecks", "humanRoleId"],
    ["authorizationChecks", "authorizationId"],
    ["hazardControls", "hazardId"],
    ["runReservations", "runId"],
    ["evidence", "evidenceId"],
  ] as const) {
    if (Array.isArray(value[field])) {
      unique(
        value[field].filter(isRecord).map((item) => String(item[id])),
        `preflightReceipt.${field}`,
        errors,
      );
    }
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, errors: [], value: value as unknown as CommonsSeededPreflightReceipt };
}

export function validateCommonsSeededPreflightRequest(
  input: unknown,
): GarpaValidationResult<CommonsSeededPreflightRequest> {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch (error) {
      return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
    }
  }
  if (!isRecord(value)) {
    return { ok: false, errors: ["Seeded preflight request must be an object."] };
  }
  const errors: string[] = [];
  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (!nonEmpty(value.expectedSeededBuildReceiptResultDigest) ||
      !SHA256.test(value.expectedSeededBuildReceiptResultDigest)) {
    errors.push("expectedSeededBuildReceiptResultDigest must be a SHA-256 hex digest.");
  }
  if (!validDate(value.admittedAt)) errors.push("admittedAt must be a valid date-time.");

  const seeded = validateCommonsSeededBuildReceiptRequest(
    value.seededBuildReceiptRequest,
  );
  errors.push(...seeded.errors.map((error) => `seededBuildReceiptRequest: ${error}`));
  const receipt = validateReceipt(value.preflightReceipt);
  errors.push(...receipt.errors);

  if (errors.length > 0 || !seeded.value || !receipt.value) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }
  return {
    ok: true,
    errors: [],
    value: {
      schemaVersion: 1,
      seededBuildReceiptRequest: seeded.value,
      expectedSeededBuildReceiptResultDigest:
        value.expectedSeededBuildReceiptResultDigest as string,
      preflightReceipt: receipt.value,
      admittedAt: value.admittedAt as string,
    },
  };
}
