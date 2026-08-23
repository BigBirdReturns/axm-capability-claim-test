import type { GarpaValidationResult } from "../../types/garpa";
import type { CommonsComponentProjectionResult } from "../../types/garpaCommonsProjection";
import type { CommonsSubstitutionSeedRequest } from "../../types/garpaCommonsSubstitutionSeed";
import type { SubstitutionPlan } from "../../types/garpaSubstitution";
import { validateCommonsComponentProjectionRequest } from "./validateCommonsProjection";

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

function validDate(value: unknown): value is string {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}

function validateProjectionResult(value: unknown): string[] {
  if (!isRecord(value)) return ["projectionResult must be an object."];
  const errors: string[] = [];
  if (typeof value.passed !== "boolean") errors.push("projectionResult.passed must be boolean.");
  if (!nonEmpty(value.state)) errors.push("projectionResult.state is required.");
  if (!Array.isArray(value.findings)) errors.push("projectionResult.findings must be an array.");
  if (
    value.readiness !== undefined &&
    !["component_candidate", "substitution_ready"].includes(String(value.readiness))
  ) {
    errors.push("projectionResult.readiness is invalid.");
  }
  if (value.projected !== undefined && !isRecord(value.projected)) {
    errors.push("projectionResult.projected must be an object when supplied.");
  }
  return errors;
}

function validatePlan(value: unknown): { errors: string[]; value?: SubstitutionPlan } {
  if (!isRecord(value)) return { errors: ["targetPlan must be an object."] };
  const errors: string[] = [];
  if (value.schemaVersion !== 1) errors.push("targetPlan.schemaVersion must be 1.");
  if (!nonEmpty(value.caseId)) errors.push("targetPlan.caseId is required.");
  if (!nonEmpty(value.capabilityGraphDigest)) {
    errors.push("targetPlan.capabilityGraphDigest is required.");
  }
  for (const field of [
    "components",
    "customCode",
    "compatibilityEdges",
    "options",
    "exclusions",
  ]) {
    if (!Array.isArray(value[field])) errors.push(`targetPlan.${field} must be an array.`);
  }
  if (!isRecord(value.costBoundary)) errors.push("targetPlan.costBoundary is required.");
  return errors.length > 0
    ? { errors }
    : { errors: [], value: value as unknown as SubstitutionPlan };
}

export function validateCommonsSubstitutionSeedRequest(
  input: unknown,
): GarpaValidationResult<CommonsSubstitutionSeedRequest> {
  const parsed = parseInput(input);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  if (!isRecord(parsed.value)) {
    return { ok: false, errors: ["Commons substitution seed request must be an object."] };
  }
  const raw = parsed.value;
  const errors: string[] = [];
  if (raw.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  for (const field of [
    "insertionId",
    "expectedTargetCaseId",
    "expectedCapabilityGraphDigest",
  ]) {
    if (!nonEmpty(raw[field])) errors.push(`${field} is required.`);
  }
  if (!validDate(raw.createdAt)) errors.push("createdAt must be a valid date-time string.");

  const projectionRequest = validateCommonsComponentProjectionRequest(
    raw.projectionRequest,
  );
  errors.push(...projectionRequest.errors.map((error) => `projectionRequest: ${error}`));
  errors.push(...validateProjectionResult(raw.projectionResult));
  const targetPlan = validatePlan(raw.targetPlan);
  errors.push(...targetPlan.errors);

  if (errors.length > 0 || !projectionRequest.value || !targetPlan.value) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }
  return {
    ok: true,
    errors: [],
    value: {
      ...(raw as unknown as CommonsSubstitutionSeedRequest),
      projectionRequest: projectionRequest.value,
      projectionResult: raw.projectionResult as CommonsComponentProjectionResult,
      targetPlan: targetPlan.value,
    },
  };
}
