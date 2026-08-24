import { z } from "zod";
import type {
  ExecutionAuthority,
  ExecutionValidationResult,
} from "../../types/garpaExecution";

const Schema = z
  .object({
    authorityId: z.string().min(1),
    executionClass: z.enum([
      "E0_analysis_only",
      "E1_simulation_or_replay",
      "E2_bench_passive",
      "E3_controlled_field_inert",
      "E4_regulated_active",
      "E5_operational_environment",
    ]),
    venueId: z.string().min(1),
    permittedActivities: z.array(z.string().min(1)),
    prohibitedActivities: z.array(z.string().min(1)),
    requiredAuthorizationRefs: z.array(z.string().min(1)),
    receivedAuthorizationRefs: z.array(z.string().min(1)),
    abortAuthority: z.array(z.string().min(1)).min(1),
    validFrom: z.string().optional(),
    expiresAt: z.string().optional(),
    evidenceArtifactIds: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((authority, ctx) => {
    if (
      authority.validFrom &&
      authority.expiresAt &&
      Date.parse(authority.expiresAt) < Date.parse(authority.validFrom)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "expiresAt cannot precede validFrom.",
      });
    }
    for (const required of authority.requiredAuthorizationRefs) {
      if (!authority.receivedAuthorizationRefs.includes(required)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["receivedAuthorizationRefs"],
          message: `Required authorization "${required}" has not been received.`,
        });
      }
    }
  });

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export function validateExecutionAuthority(
  input: unknown,
): ExecutionValidationResult<ExecutionAuthority> {
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
  return { ok: true, errors: [], value: parsed.data as ExecutionAuthority };
}
