import type { GarpaValidationResult } from "../../types/garpa";
import type {
  CommonsSeededMissionBoundary,
  CommonsSeededMissionEvaluationEnvelope,
  CommonsSeededMissionEvaluationRequest,
} from "../../types/garpaCommonsSeededMissionEvaluation";
import { validateCommonsSeededTestRunRequest } from "./validateCommonsSeededTestRun";

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

function validateMissionBoundary(
  value: unknown,
): GarpaValidationResult<CommonsSeededMissionBoundary> {
  if (!isRecord(value)) {
    return { ok: false, errors: ["missionBoundary must be an object."] };
  }
  const errors: string[] = [];
  if (typeof value.fullMissionBoundary !== "boolean") {
    errors.push("missionBoundary.fullMissionBoundary must be a boolean.");
  }
  if (!nonEmpty(value.boundaryDescription)) {
    errors.push("missionBoundary.boundaryDescription is required.");
  }
  return errors.length > 0
    ? { ok: false, errors }
    : {
        ok: true,
        errors: [],
        value: value as unknown as CommonsSeededMissionBoundary,
      };
}

function validateEnvelope(
  value: unknown,
): GarpaValidationResult<CommonsSeededMissionEvaluationEnvelope> {
  if (!isRecord(value)) {
    return { ok: false, errors: ["evaluationEnvelope must be an object."] };
  }
  const errors: string[] = [];
  if (value.schemaVersion !== 1) {
    errors.push("evaluationEnvelope.schemaVersion must equal 1.");
  }
  for (const field of [
    "evaluationId",
    "caseId",
    "missionOutcomeDigest",
    "qualificationContractDigest",
    "asBuiltReceiptDigest",
    "campaignPreflightReceiptDigest",
    "runSetDigest",
    "evaluatedAt",
    "envelopeDigest",
  ]) {
    if (!nonEmpty(value[field])) {
      errors.push(`evaluationEnvelope.${field} is required.`);
    }
  }
  for (const field of [
    "missionOutcomeDigest",
    "qualificationContractDigest",
    "asBuiltReceiptDigest",
    "campaignPreflightReceiptDigest",
    "runSetDigest",
    "envelopeDigest",
  ]) {
    if (nonEmpty(value[field]) && !SHA256.test(value[field])) {
      errors.push(`evaluationEnvelope.${field} must be a SHA-256 hex digest.`);
    }
  }
  if (!validDate(value.evaluatedAt)) {
    errors.push("evaluationEnvelope.evaluatedAt must be a valid date-time.");
  }
  if (value.qualificationTransferred !== false) {
    errors.push("evaluationEnvelope.qualificationTransferred must be false.");
  }
  if (value.missionEquivalenceClaimed !== false) {
    errors.push("evaluationEnvelope.missionEquivalenceClaimed must be false.");
  }
  if (!Array.isArray(value.runBindings) || value.runBindings.length === 0) {
    errors.push("evaluationEnvelope.runBindings must be a non-empty array.");
  } else {
    const runIds = new Set<string>();
    value.runBindings.forEach((binding, index) => {
      const path = `evaluationEnvelope.runBindings.${index}`;
      if (!isRecord(binding)) {
        errors.push(`${path} must be an object.`);
        return;
      }
      for (const field of [
        "runId",
        "scenarioId",
        "reservationReceiptId",
        "expectedTestRunResultDigest",
        "expectedTestRunReceiptDigest",
        "expectedSeededPreflightResultDigest",
        "expectedPreflightReceiptDigest",
        "expectedAsBuiltReceiptDigest",
        "expectedQualificationContractDigest",
      ]) {
        if (!nonEmpty(binding[field])) {
          errors.push(`${path}.${field} is required.`);
        }
      }
      for (const field of [
        "expectedTestRunResultDigest",
        "expectedTestRunReceiptDigest",
        "expectedSeededPreflightResultDigest",
        "expectedPreflightReceiptDigest",
        "expectedAsBuiltReceiptDigest",
        "expectedQualificationContractDigest",
      ]) {
        if (nonEmpty(binding[field]) && !SHA256.test(binding[field])) {
          errors.push(`${path}.${field} must be a SHA-256 hex digest.`);
        }
      }
      const runId = String(binding.runId ?? "");
      if (runIds.has(runId)) {
        errors.push(
          `evaluationEnvelope.runBindings contains duplicate run id "${runId}".`,
        );
      }
      runIds.add(runId);
    });
  }
  return errors.length > 0
    ? { ok: false, errors }
    : {
        ok: true,
        errors: [],
        value: value as unknown as CommonsSeededMissionEvaluationEnvelope,
      };
}

export function validateCommonsSeededMissionEvaluationRequest(
  input: unknown,
): GarpaValidationResult<CommonsSeededMissionEvaluationRequest> {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch (error) {
      return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
    }
  }
  if (!isRecord(value)) {
    return {
      ok: false,
      errors: ["Commons-seeded mission-evaluation request must be an object."],
    };
  }

  const errors: string[] = [];
  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (!validDate(value.admittedAt)) {
    errors.push("admittedAt must be a valid date-time.");
  }
  if (!Array.isArray(value.testRunRequests) || value.testRunRequests.length === 0) {
    errors.push("testRunRequests must be a non-empty array.");
  }
  const requests = Array.isArray(value.testRunRequests)
    ? value.testRunRequests.map((request, index) => {
        const validated = validateCommonsSeededTestRunRequest(request);
        errors.push(
          ...validated.errors.map(
            (error) => `testRunRequests.${index}: ${error}`,
          ),
        );
        return validated.value;
      })
    : [];

  const missionBoundary = validateMissionBoundary(value.missionBoundary);
  errors.push(...missionBoundary.errors);
  const envelope = validateEnvelope(value.evaluationEnvelope);
  errors.push(...envelope.errors);

  if (
    errors.length > 0 ||
    requests.some((request) => !request) ||
    !missionBoundary.value ||
    !envelope.value
  ) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }
  return {
    ok: true,
    errors: [],
    value: {
      schemaVersion: 1,
      testRunRequests:
        requests as CommonsSeededMissionEvaluationRequest["testRunRequests"],
      missionBoundary: missionBoundary.value,
      evaluationEnvelope: envelope.value,
      admittedAt: value.admittedAt as string,
    },
  };
}
