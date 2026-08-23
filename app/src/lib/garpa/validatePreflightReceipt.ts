import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type { PreflightReceipt } from "../../types/garpaPreflight";

const ReadinessSchema = z
  .object({
    fixtureReady: z.boolean(),
    instrumentationReady: z.boolean(),
    calibrationReady: z.boolean(),
    storageReady: z.boolean(),
    clocksReady: z.boolean(),
    authorityReady: z.boolean(),
    hazardControlsReady: z.boolean(),
    abortPathReady: z.boolean(),
    operatorRolesReady: z.boolean(),
    runIdReserved: z.boolean(),
  })
  .strict();

const GateSchema = z
  .object({
    passed: z.boolean(),
    manifestCurrent: z.boolean(),
    qualificationContractCurrent: z.boolean(),
    buildStateAdmissible: z.boolean(),
    materialDeviationsClosed: z.boolean(),
    readiness: ReadinessSchema,
    blockingReasons: z.array(z.string()),
  })
  .strict();

const PreflightReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    runId: z.string().min(1),
    buildId: z.string().min(1),
    buildDigest: z.string().min(1),
    manifestDigest: z.string().min(1),
    qualificationContractDigest: z.string().min(1),
    readiness: ReadinessSchema,
    gate: GateSchema,
    evaluatedAt: z.string().min(1),
    preflightDigest: z.string().min(1),
  })
  .strict();

function parseInput(input: unknown): GarpaValidationResult<unknown> {
  if (typeof input !== "string") return { ok: true, errors: [], value: input };
  try {
    return { ok: true, errors: [], value: JSON.parse(input) as unknown };
  } catch (error) {
    return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
  }
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

function sameReadiness(
  a: PreflightReceipt["readiness"],
  b: PreflightReceipt["readiness"],
): boolean {
  return (Object.keys(a) as Array<keyof typeof a>).every((key) => a[key] === b[key]);
}

export function validatePreflightReceipt(
  input: unknown,
): GarpaValidationResult<PreflightReceipt> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  const parsed = PreflightReceiptSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const receipt = parsed.data as PreflightReceipt;
  const errors: string[] = [];
  if (!sameReadiness(receipt.readiness, receipt.gate.readiness)) {
    errors.push("receipt readiness differs from the readiness evaluated by the gate.");
  }
  if (receipt.gate.passed !== (receipt.gate.blockingReasons.length === 0)) {
    errors.push("gate passed state is inconsistent with its blocking reasons.");
  }
  if (Number.isNaN(Date.parse(receipt.evaluatedAt))) {
    errors.push("evaluatedAt is not a parseable timestamp.");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: receipt };
}
