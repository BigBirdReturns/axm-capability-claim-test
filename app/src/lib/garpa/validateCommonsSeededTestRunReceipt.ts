import type { GarpaValidationResult } from "../../types/garpa";
import type { TestRunReceipt } from "../../types/garpaExecution";
import { validateTestRunReceipt } from "./validateExecutionReceipts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parsedInput(input: unknown): GarpaValidationResult<unknown> {
  if (typeof input !== "string") return { ok: true, errors: [], value: input };
  try {
    return { ok: true, errors: [], value: JSON.parse(input) as unknown };
  } catch (error) {
    return {
      ok: false,
      errors: [`Invalid JSON: ${(error as Error).message}`],
    };
  }
}

/**
 * Applies the ordinary receipt shape and custody checks without consuming the
 * state contradictions that the Commons execution gate is responsible for
 * classifying. The normalized copy is validation-only; the original immutable
 * receipt is returned to the gate.
 */
export function validateCommonsSeededTestRunReceipt(
  input: unknown,
): GarpaValidationResult<TestRunReceipt> {
  const parsed = parsedInput(input);
  if (!parsed.ok || !isRecord(parsed.value)) {
    return {
      ok: false,
      errors: parsed.ok
        ? ["testRunReceipt must be an object."]
        : parsed.errors,
    };
  }

  const original = parsed.value;
  const normalized = structuredClone(original);
  const aborts = Array.isArray(normalized.aborts)
    ? normalized.aborts.filter(isRecord)
    : [];
  for (const abort of aborts) delete abort.evidenceArtifactIds;

  const anomalies = Array.isArray(normalized.anomalies)
    ? normalized.anomalies.filter(isRecord)
    : [];
  const hasInvalidatingAnomaly = anomalies.some(
    (anomaly) => anomaly.disposition === "invalidates_run",
  );

  if (normalized.state === "valid" && aborts.length > 0) {
    normalized.state = "aborted";
  } else if (normalized.state === "valid" && hasInvalidatingAnomaly) {
    normalized.state = "invalidated";
  }

  if (normalized.state === "aborted" && aborts.length === 0) {
    normalized.aborts = [
      {
        id: "commons-structural-validation-placeholder",
        occurredAt:
          typeof normalized.endedAt === "string"
            ? normalized.endedAt
            : "1970-01-01T00:00:00.000Z",
        authority: "Commons structural validator",
        reason: "Validation-only placeholder; the gate retains the missing abort custody finding.",
      },
    ];
  }

  const validated = validateTestRunReceipt(normalized);
  if (!validated.ok) return { ok: false, errors: validated.errors };
  return {
    ok: true,
    errors: [],
    value: original as unknown as TestRunReceipt,
  };
}
