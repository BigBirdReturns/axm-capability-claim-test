import type {
  CommonsComponentProjectionRequest,
  CommonsComponentProjectionIntent,
} from "../../types/garpaCommonsProjection";
import type { GarpaValidationResult } from "../../types/garpa";
import type { SubstitutionPlan } from "../../types/garpaSubstitution";
import { validateClaimPacket } from "./validateClaimPacket";
import { validateCommonsTransferRequest } from "./validateCommonsTransfer";
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

function validDate(value: unknown): value is string {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export function validateCommonsComponentProjectionRequest(
  input: unknown,
): GarpaValidationResult<CommonsComponentProjectionRequest> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  if (!isRecord(raw.value)) {
    return { ok: false, errors: ["Projection request must be an object."] };
  }

  const request = raw.value;
  const errors: string[] = [];
  if (request.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (
    !nonEmpty(request.expectedTransferResultDigest) ||
    !SHA256.test(request.expectedTransferResultDigest)
  ) {
    errors.push("expectedTransferResultDigest must be a SHA-256 hex digest.");
  }
  if (!validDate(request.projectedAt)) {
    errors.push("projectedAt must be a valid date-time string.");
  }

  const transfer = validateCommonsTransferRequest(request.transferRequest);
  errors.push(...transfer.errors.map((error) => `transferRequest: ${error}`));
  const packet = validateClaimPacket(request.targetClaimPacket);
  errors.push(...packet.errors.map((error) => `targetClaimPacket: ${error}`));

  if (!Array.isArray(request.projections) || request.projections.length === 0) {
    errors.push("projections must contain at least one projection intent.");
  } else {
    request.projections.forEach((projection, index) => {
      if (!isRecord(projection)) {
        errors.push(`projections.${index} must be an object.`);
        return;
      }
      if (!nonEmpty(projection.projectionId)) {
        errors.push(`projections.${index}.projectionId is required.`);
      }
      if (!nonEmpty(projection.nominationId)) {
        errors.push(`projections.${index}.nominationId is required.`);
      }
      if (!isRecord(projection.candidate)) {
        errors.push(`projections.${index}.candidate must be an object.`);
      }
    });
  }

  if (Array.isArray(request.projections)) {
    const projections = request.projections as Array<Record<string, unknown>>;
    for (const duplicate of duplicateValues(
      projections.map((projection) => String(projection.projectionId)),
    )) {
      errors.push(`projections contains duplicate projectionId "${duplicate}".`);
    }
    for (const duplicate of duplicateValues(
      projections.map((projection) => String(projection.nominationId)),
    )) {
      errors.push(`projections contains duplicate nominationId "${duplicate}".`);
    }
  }

  if (errors.length > 0 || !transfer.value || !packet.value) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }

  const projections = request.projections as unknown as CommonsComponentProjectionIntent[];
  for (const [index, projection] of projections.entries()) {
    const plan: SubstitutionPlan = {
      schemaVersion: 1,
      caseId: transfer.value.targetCapabilityGraph.caseId,
      capabilityGraphDigest: transfer.value.targetCapabilityGraphDigest,
      components: [projection.candidate],
      customCode: [],
      compatibilityEdges: [],
      options: [],
      costBoundary: {
        state: "unresolved",
        includedCategories: [],
        excludedCategories: [],
      },
      exclusions: [],
    };
    const candidate = validateSubstitutionPlan(
      plan,
      transfer.value.targetCapabilityGraph,
      packet.value,
    );
    errors.push(
      ...candidate.errors.map((error) => `projections.${index}.candidate: ${error}`),
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }
  return {
    ok: true,
    errors: [],
    value: {
      ...(request as unknown as CommonsComponentProjectionRequest),
      transferRequest: transfer.value,
      targetClaimPacket: packet.value,
      projections,
    },
  };
}
