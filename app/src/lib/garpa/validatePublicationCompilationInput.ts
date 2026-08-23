import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type { PublicationCompilationInput } from "../../types/garpaPublication";

const Schema = z
  .object({
    caseId: z.string().min(1),
    subject: z.string().min(1),
    offeringVersion: z.string().optional(),
    missionEvaluationDigest: z.string().min(1),
    missionEvaluationState: z.enum([
      "matched",
      "bounded_match",
      "partial",
      "failed",
      "incomparable",
      "unassessed",
    ]),
    missionBuildDigest: z.string().min(1),
    missionScenarioIds: z.array(z.string().min(1)),
    missionMetricIds: z.array(z.string().min(1)),
    missionResiduals: z.array(z.string()),
    missionRunReceiptIds: z.array(z.string().min(1)),
    vendorParityDigest: z.string().optional(),
    vendorParityState: z
      .enum([
        "same_fixture_match",
        "same_fixture_miss",
        "evidence_only_comparison",
        "vendor_baseline_missing",
        "scenario_mismatch",
        "accounting_boundary_mismatch",
        "incomparable",
        "not_attempted",
      ])
      .optional(),
    vendorOffering: z.string().optional(),
    vendorVersion: z.string().optional(),
    matchedParityMetricIds: z.array(z.string().min(1)).optional(),
    parityScopeBoundary: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const anyParityField = Boolean(
      value.vendorParityDigest || value.vendorParityState || value.vendorOffering,
    );
    if (anyParityField) {
      if (!value.vendorParityDigest) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["vendorParityDigest"],
          message: "Parity compilation requires a parity evaluation digest.",
        });
      }
      if (!value.vendorParityState) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["vendorParityState"],
          message: "Parity compilation requires a parity state.",
        });
      }
      if (!value.vendorOffering?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["vendorOffering"],
          message: "Parity compilation requires a vendor offering.",
        });
      }
    }
    if (value.vendorParityState === "same_fixture_match") {
      if (!value.vendorVersion?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["vendorVersion"],
          message: "A same-fixture parity claim requires the exact vendor version.",
        });
      }
      if (!(value.matchedParityMetricIds?.length)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["matchedParityMetricIds"],
          message: "A same-fixture parity claim requires matched metric identifiers.",
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

export function validatePublicationCompilationInput(
  input: unknown,
): GarpaValidationResult<PublicationCompilationInput> {
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
  return { ok: true, errors: [], value: parsed.data as PublicationCompilationInput };
}
