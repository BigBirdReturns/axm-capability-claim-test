import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type { PreflightRequest } from "../../types/garpaExecution";
import {
  validateBuildReceipt,
  validateExecutionAuthority,
} from "./validateExecutionReceipts";

const Schema = z
  .object({
    expectedArchitectureDigest: z.string().min(1),
    expectedBuildManifestDigest: z.string().min(1),
    expectedQualificationContractDigest: z.string().min(1),
    requiredExecutionClass: z.enum([
      "E0_analysis_only",
      "E1_simulation_or_replay",
      "E2_bench_passive",
      "E3_controlled_field_inert",
      "E4_regulated_active",
      "E5_operational_environment",
    ]),
    requiredActivities: z.array(z.string().min(1)),
    requiredOperatorRoles: z.array(z.string().min(1)),
    buildReceipt: z.unknown(),
    authority: z.unknown(),
    instrumentation: z.array(
      z
        .object({
          instrumentId: z.string().min(1),
          required: z.boolean(),
          present: z.boolean(),
          calibrationState: z.enum(["current", "expired", "not_required", "unknown"]),
          clockSynchronized: z.boolean(),
        })
        .strict(),
    ),
    fixtureReady: z.boolean(),
    storageReady: z.boolean(),
    clocksReady: z.boolean(),
    abortPathReady: z.boolean(),
    runIdReserved: z.boolean(),
    assignedOperatorRoles: z.array(z.string().min(1)),
    now: z.string().min(1),
  })
  .strict();

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export function validatePreflightRequest(
  input: unknown,
): GarpaValidationResult<PreflightRequest> {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input) as unknown;
    } catch (error) {
      return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
    }
  }

  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const build = validateBuildReceipt(parsed.data.buildReceipt);
  const authority = validateExecutionAuthority(parsed.data.authority);
  const errors = [
    ...build.errors.map((error) => `buildReceipt: ${error}`),
    ...authority.errors.map((error) => `authority: ${error}`),
  ];
  if (!build.ok || !build.value || !authority.ok || !authority.value) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    value: {
      ...parsed.data,
      buildReceipt: build.value,
      authority: authority.value,
    },
  };
}
