import type { GarpaValidationResult } from "../../types/garpa";
import type {
  CommonsSeededBuildManifestBinding,
  CommonsSeededBuildManifestRequest,
} from "../../types/garpaCommonsSeededBuildManifest";
import { validateBuildManifest } from "./validateBuildManifest";
import { validateCommonsSeededQualificationRequest } from "./validateCommonsSeededQualification";

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
    "qualificationBindingId",
    "architectureSelectionDigest",
    "architectureConfigurationDigest",
    "buildComponentDigest",
    "substitutionPolicyDigest",
  ]) {
    if (!nonEmpty(value[field])) errors.push(`${path}.${field} is required.`);
  }
  for (const field of [
    "sourceObjectDigest",
    "architectureSelectionDigest",
    "architectureConfigurationDigest",
    "buildComponentDigest",
    "substitutionPolicyDigest",
  ]) {
    if (nonEmpty(value[field]) && !SHA256.test(value[field])) {
      errors.push(`${path}.${field} must be a SHA-256 hex digest.`);
    }
  }
  if (
    !stringArray(value.requiredCalibrationItemIds) ||
    value.requiredCalibrationItemIds.length === 0
  ) {
    errors.push(
      `${path}.requiredCalibrationItemIds must contain at least one calibration or verification item.`,
    );
  } else if (duplicates(value.requiredCalibrationItemIds).length > 0) {
    errors.push(`${path}.requiredCalibrationItemIds must be unique.`);
  }
  if (
    !stringArray(value.requiredAssemblyStepIds) ||
    value.requiredAssemblyStepIds.length === 0
  ) {
    errors.push(`${path}.requiredAssemblyStepIds must contain at least one id.`);
  } else if (duplicates(value.requiredAssemblyStepIds).length > 0) {
    errors.push(`${path}.requiredAssemblyStepIds must be unique.`);
  }
  return errors;
}

export function validateCommonsSeededBuildManifestRequest(
  input: unknown,
): GarpaValidationResult<CommonsSeededBuildManifestRequest> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  if (!isRecord(raw.value)) {
    return {
      ok: false,
      errors: ["Seeded build-manifest request must be an object."],
    };
  }

  const request = raw.value;
  const errors: string[] = [];
  if (request.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (
    !nonEmpty(request.expectedSeededQualificationResultDigest) ||
    !SHA256.test(request.expectedSeededQualificationResultDigest)
  ) {
    errors.push(
      "expectedSeededQualificationResultDigest must be a SHA-256 hex digest.",
    );
  }
  if (
    !nonEmpty(request.frozenAt) ||
    !Number.isFinite(Date.parse(request.frozenAt))
  ) {
    errors.push("frozenAt must be a valid date-time string.");
  }

  const seededQualification = validateCommonsSeededQualificationRequest(
    request.seededQualificationRequest,
  );
  errors.push(
    ...seededQualification.errors.map(
      (error) => `seededQualificationRequest: ${error}`,
    ),
  );

  if (!Array.isArray(request.seededComponentBindings)) {
    errors.push("seededComponentBindings must be an array.");
  } else {
    request.seededComponentBindings.forEach((binding, index) => {
      errors.push(
        ...validateBindingShape(binding, `seededComponentBindings.${index}`),
      );
    });
    const bindings = request.seededComponentBindings as Array<
      Record<string, unknown>
    >;
    for (const duplicate of duplicates(
      bindings.map((item) => String(item.bindingId)),
    )) {
      errors.push(
        `seededComponentBindings contains duplicate bindingId "${duplicate}".`,
      );
    }
    for (const duplicate of duplicates(
      bindings.map((item) => String(item.componentId)),
    )) {
      errors.push(
        `seededComponentBindings contains duplicate componentId "${duplicate}".`,
      );
    }
  }

  if (!isRecord(request.buildManifest)) {
    errors.push("buildManifest must be an object.");
  }

  if (
    errors.length > 0 ||
    !seededQualification.value ||
    !isRecord(request.buildManifest)
  ) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }

  const architecture =
    seededQualification.value.seededArchitectureRequest.architecture;
  const plan =
    seededQualification.value.seededArchitectureRequest.seededSubstitutionRequest
      .plan;
  const buildManifest = validateBuildManifest(
    request.buildManifest,
    architecture,
    plan,
    seededQualification.value.qualificationContract,
  );
  errors.push(
    ...buildManifest.errors.map((error) => `buildManifest: ${error}`),
  );
  if (errors.length > 0 || !buildManifest.value) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }

  return {
    ok: true,
    errors: [],
    value: {
      ...(request as unknown as CommonsSeededBuildManifestRequest),
      seededQualificationRequest: seededQualification.value,
      buildManifest: buildManifest.value,
      seededComponentBindings:
        request.seededComponentBindings as unknown as CommonsSeededBuildManifestBinding[],
    },
  };
}
