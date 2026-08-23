import type { GarpaValidationResult } from "../../types/garpa";
import type { CommonsSeededSubstitutionRequest } from "../../types/garpaCommonsSeededSubstitution";
import { validateCommonsComponentProjectionRequest } from "./validateCommonsComponentProjection";
import { validateSubstitutionPlan } from "./validateSubstitutionPlan";

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

export function validateCommonsSeededSubstitutionRequest(
  input: unknown,
): GarpaValidationResult<CommonsSeededSubstitutionRequest> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  if (!isRecord(raw.value)) {
    return { ok: false, errors: ["Seeded substitution request must be an object."] };
  }

  const request = raw.value;
  const errors: string[] = [];
  if (request.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (
    !nonEmpty(request.expectedProjectionResultDigest) ||
    !SHA256.test(request.expectedProjectionResultDigest)
  ) {
    errors.push("expectedProjectionResultDigest must be a SHA-256 hex digest.");
  }
  if (!nonEmpty(request.assembledAt) || !Number.isFinite(Date.parse(request.assembledAt))) {
    errors.push("assembledAt must be a valid date-time string.");
  }

  const projection = validateCommonsComponentProjectionRequest(
    request.projectionRequest,
  );
  errors.push(...projection.errors.map((error) => `projectionRequest: ${error}`));

  if (!isRecord(request.plan)) {
    errors.push("plan must be an object.");
  }

  if (errors.length > 0 || !projection.value || !isRecord(request.plan)) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }

  const plan = validateSubstitutionPlan(
    request.plan,
    projection.value.transferRequest.targetCapabilityGraph,
    projection.value.targetClaimPacket,
  );
  errors.push(...plan.errors.map((error) => `plan: ${error}`));
  if (errors.length > 0 || !plan.value) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }

  return {
    ok: true,
    errors: [],
    value: {
      ...(request as unknown as CommonsSeededSubstitutionRequest),
      projectionRequest: projection.value,
      plan: plan.value,
    },
  };
}
