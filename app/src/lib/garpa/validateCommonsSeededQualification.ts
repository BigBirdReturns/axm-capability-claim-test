import type { GarpaValidationResult } from "../../types/garpa";
import type {
  CommonsSeededQualificationBinding,
  CommonsSeededQualificationRequest,
} from "../../types/garpaCommonsSeededQualification";
import { validateCommonsSeededArchitectureRequest } from "./validateCommonsSeededArchitecture";
import { validateMissionOutcome } from "./validateClaimPacket";
import { validateQualificationContract } from "./validateQualificationContract";

const SHA256 = /^[a-f0-9]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseInput(input: unknown): GarpaValidationResult<unknown> {
  if (typeof input !== "string") return { ok: true, errors: [], value: input };
  try {
    return { ok: true, errors: [], value: JSON.parse(input) as unknown };
  } catch (error) {
    return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
  }
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmpty);
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

function validateBindingShape(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path} must be an object.`];
  const errors: string[] = [];
  for (const field of [
    "bindingId",
    "componentId",
    "sourceCatalogObjectId",
    "sourceRevisionId",
    "sourceObjectDigest",
    "architectureSelectionDigest",
  ]) {
    if (!nonEmpty(value[field])) errors.push(`${path}.${field} is required.`);
  }
  for (const field of ["sourceObjectDigest", "architectureSelectionDigest"]) {
    if (nonEmpty(value[field]) && !SHA256.test(value[field])) {
      errors.push(`${path}.${field} must be a SHA-256 hex digest.`);
    }
  }
  for (const field of ["riskIds", "residualIds"]) {
    if (!stringArray(value[field])) {
      errors.push(`${path}.${field} must contain non-empty strings.`);
    }
  }
  if (!Array.isArray(value.requiredTestClosures)) {
    errors.push(`${path}.requiredTestClosures must be an array.`);
  } else {
    value.requiredTestClosures.forEach((closure, index) => {
      const closurePath = `${path}.requiredTestClosures.${index}`;
      if (!isRecord(closure)) {
        errors.push(`${closurePath} must be an object.`);
        return;
      }
      if (!nonEmpty(closure.requirement)) {
        errors.push(`${closurePath}.requirement is required.`);
      }
      if (!stringArray(closure.scenarioIds) || closure.scenarioIds.length === 0) {
        errors.push(`${closurePath}.scenarioIds must contain at least one id.`);
      }
      if (!stringArray(closure.metricIds) || closure.metricIds.length === 0) {
        errors.push(`${closurePath}.metricIds must contain at least one id.`);
      }
      if (!nonEmpty(closure.rationale)) {
        errors.push(`${closurePath}.rationale is required.`);
      }
    });
  }
  return errors;
}

export function validateCommonsSeededQualificationRequest(
  input: unknown,
): GarpaValidationResult<CommonsSeededQualificationRequest> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  if (!isRecord(raw.value)) {
    return { ok: false, errors: ["Seeded qualification request must be an object."] };
  }

  const request = raw.value;
  const errors: string[] = [];
  if (request.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  for (const field of [
    "expectedSeededArchitectureResultDigest",
    "targetMissionOutcomeDigest",
  ]) {
    if (!nonEmpty(request[field]) || !SHA256.test(request[field] as string)) {
      errors.push(`${field} must be a SHA-256 hex digest.`);
    }
  }
  if (!nonEmpty(request.frozenAt) || !Number.isFinite(Date.parse(request.frozenAt))) {
    errors.push("frozenAt must be a valid date-time string.");
  }

  const seededArchitecture = validateCommonsSeededArchitectureRequest(
    request.seededArchitectureRequest,
  );
  errors.push(
    ...seededArchitecture.errors.map(
      (error) => `seededArchitectureRequest: ${error}`,
    ),
  );

  const packet = seededArchitecture.value?.seededSubstitutionRequest
    .projectionRequest.targetClaimPacket;
  const outcome = validateMissionOutcome(request.targetMissionOutcome, packet);
  errors.push(...outcome.errors.map((error) => `targetMissionOutcome: ${error}`));

  if (!Array.isArray(request.seededComponentBindings)) {
    errors.push("seededComponentBindings must be an array.");
  } else {
    request.seededComponentBindings.forEach((binding, index) => {
      errors.push(
        ...validateBindingShape(binding, `seededComponentBindings.${index}`),
      );
    });
    const bindings = request.seededComponentBindings as Array<Record<string, unknown>>;
    for (const duplicate of duplicates(bindings.map((item) => String(item.bindingId)))) {
      errors.push(`seededComponentBindings contains duplicate bindingId "${duplicate}".`);
    }
    for (const duplicate of duplicates(bindings.map((item) => String(item.componentId)))) {
      errors.push(`seededComponentBindings contains duplicate componentId "${duplicate}".`);
    }
  }

  if (!isRecord(request.qualificationContract)) {
    errors.push("qualificationContract must be an object.");
  }

  if (
    errors.length > 0 ||
    !seededArchitecture.value ||
    !outcome.value ||
    !packet ||
    !isRecord(request.qualificationContract)
  ) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }

  const contract = validateQualificationContract(
    request.qualificationContract,
    outcome.value,
    seededArchitecture.value.architecture,
    packet,
  );
  errors.push(...contract.errors.map((error) => `qualificationContract: ${error}`));
  if (errors.length > 0 || !contract.value) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }

  return {
    ok: true,
    errors: [],
    value: {
      ...(request as unknown as CommonsSeededQualificationRequest),
      seededArchitectureRequest: seededArchitecture.value,
      targetMissionOutcome: outcome.value,
      qualificationContract: contract.value,
      seededComponentBindings:
        request.seededComponentBindings as unknown as CommonsSeededQualificationBinding[],
    },
  };
}
