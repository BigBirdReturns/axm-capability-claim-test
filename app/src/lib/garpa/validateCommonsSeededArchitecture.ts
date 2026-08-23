import type { GarpaValidationResult } from "../../types/garpa";
import type { CommonsSeededArchitectureRequest } from "../../types/garpaCommonsSeededArchitecture";
import { validateCandidateArchitecture } from "./validateCandidateArchitecture";
import { validateCommonsSeededSubstitutionRequest } from "./validateCommonsSeededSubstitution";

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

export function validateCommonsSeededArchitectureRequest(
  input: unknown,
): GarpaValidationResult<CommonsSeededArchitectureRequest> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  if (!isRecord(raw.value)) {
    return { ok: false, errors: ["Seeded architecture request must be an object."] };
  }

  const request = raw.value;
  const errors: string[] = [];
  if (request.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (
    !nonEmpty(request.expectedSeededSubstitutionResultDigest) ||
    !SHA256.test(request.expectedSeededSubstitutionResultDigest)
  ) {
    errors.push(
      "expectedSeededSubstitutionResultDigest must be a SHA-256 hex digest.",
    );
  }
  if (!nonEmpty(request.assembledAt) || !Number.isFinite(Date.parse(request.assembledAt))) {
    errors.push("assembledAt must be a valid date-time string.");
  }

  const seeded = validateCommonsSeededSubstitutionRequest(
    request.seededSubstitutionRequest,
  );
  errors.push(
    ...seeded.errors.map((error) => `seededSubstitutionRequest: ${error}`),
  );
  if (!isRecord(request.architecture)) {
    errors.push("architecture must be an object.");
  }

  if (errors.length > 0 || !seeded.value || !isRecord(request.architecture)) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }

  const projection = seeded.value.projectionRequest;
  const architecture = validateCandidateArchitecture(
    request.architecture,
    projection.transferRequest.targetCapabilityGraph,
    seeded.value.plan,
    projection.targetClaimPacket,
  );
  errors.push(
    ...architecture.errors.map((error) => `architecture: ${error}`),
  );
  if (errors.length > 0 || !architecture.value) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }

  return {
    ok: true,
    errors: [],
    value: {
      ...(request as unknown as CommonsSeededArchitectureRequest),
      seededSubstitutionRequest: seeded.value,
      architecture: architecture.value,
    },
  };
}
