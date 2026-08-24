import type { GarpaValidationResult } from "../../types/garpa";
import type {
  CommonsSeededTestRunEnvelope,
  CommonsSeededTestRunRequest,
} from "../../types/garpaCommonsSeededTestRun";
import { validateTestRunReceipt } from "./validateExecutionReceipts";
import { validateCommonsSeededPreflightRequest } from "./validateCommonsSeededPreflight";

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

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate];
}

function validateEnvelope(
  input: unknown,
): GarpaValidationResult<CommonsSeededTestRunEnvelope> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["executionEnvelope must be an object."] };
  }
  const errors: string[] = [];
  if (input.schemaVersion !== 1) {
    errors.push("executionEnvelope.schemaVersion must equal 1.");
  }
  requireStrings(
    input,
    [
      "receiptId",
      "caseId",
      "seededPreflightResultDigest",
      "preflightReceiptDigest",
      "asBuiltReceiptDigest",
      "qualificationContractDigest",
      "runReservationReceiptId",
      "executedAt",
      "envelopeDigest",
    ],
    "executionEnvelope",
    errors,
  );
  for (const field of [
    "seededPreflightResultDigest",
    "preflightReceiptDigest",
    "asBuiltReceiptDigest",
    "qualificationContractDigest",
    "envelopeDigest",
  ]) {
    if (nonEmpty(input[field]) && !SHA256.test(input[field])) {
      errors.push(`executionEnvelope.${field} must be a SHA-256 hex digest.`);
    }
  }
  if (!validDate(input.executedAt)) {
    errors.push("executionEnvelope.executedAt must be a valid date-time.");
  }
  if (input.qualificationTransferred !== false) {
    errors.push("executionEnvelope.qualificationTransferred must be false.");
  }
  if (input.missionEquivalenceClaimed !== false) {
    errors.push("executionEnvelope.missionEquivalenceClaimed must be false.");
  }
  if (!Array.isArray(input.artifacts)) {
    errors.push("executionEnvelope.artifacts must be an array.");
  } else {
    const ids: string[] = [];
    input.artifacts.forEach((artifact, index) => {
      const path = `executionEnvelope.artifacts.${index}`;
      if (!isRecord(artifact)) {
        errors.push(`${path} must be an object.`);
        return;
      }
      requireStrings(
        artifact,
        ["artifactId", "sha256", "mediaType", "path", "capturedAt"],
        path,
        errors,
      );
      if (nonEmpty(artifact.sha256) && !SHA256.test(artifact.sha256)) {
        errors.push(`${path}.sha256 must be a SHA-256 hex digest.`);
      }
      if (nonEmpty(artifact.capturedAt) && !validDate(artifact.capturedAt)) {
        errors.push(`${path}.capturedAt must be a valid date-time.`);
      }
      if (nonEmpty(artifact.artifactId)) ids.push(artifact.artifactId);
    });
    for (const id of duplicates(ids)) {
      errors.push(`executionEnvelope.artifacts contains duplicate id "${id}".`);
    }
  }
  return errors.length > 0
    ? { ok: false, errors }
    : {
        ok: true,
        errors: [],
        value: input as unknown as CommonsSeededTestRunEnvelope,
      };
}

export function validateCommonsSeededTestRunRequest(
  input: unknown,
): GarpaValidationResult<CommonsSeededTestRunRequest> {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch (error) {
      return {
        ok: false,
        errors: [`Invalid JSON: ${(error as Error).message}`],
      };
    }
  }
  if (!isRecord(value)) {
    return {
      ok: false,
      errors: ["Commons-seeded test-run request must be an object."],
    };
  }
  const errors: string[] = [];
  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (
    !nonEmpty(value.expectedSeededPreflightResultDigest) ||
    !SHA256.test(value.expectedSeededPreflightResultDigest)
  ) {
    errors.push(
      "expectedSeededPreflightResultDigest must be a SHA-256 hex digest.",
    );
  }
  if (!validDate(value.admittedAt)) {
    errors.push("admittedAt must be a valid date-time.");
  }

  const preflight = validateCommonsSeededPreflightRequest(
    value.seededPreflightRequest,
  );
  errors.push(
    ...preflight.errors.map((error) => `seededPreflightRequest: ${error}`),
  );
  const receipt = validateTestRunReceipt(value.testRunReceipt);
  errors.push(...receipt.errors.map((error) => `testRunReceipt: ${error}`));
  const envelope = validateEnvelope(value.executionEnvelope);
  errors.push(...envelope.errors);

  if (
    errors.length > 0 ||
    !preflight.value ||
    !receipt.value ||
    !envelope.value
  ) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }
  return {
    ok: true,
    errors: [],
    value: {
      schemaVersion: 1,
      seededPreflightRequest: preflight.value,
      expectedSeededPreflightResultDigest:
        value.expectedSeededPreflightResultDigest as string,
      testRunReceipt: receipt.value,
      executionEnvelope: envelope.value,
      admittedAt: value.admittedAt as string,
    },
  };
}
