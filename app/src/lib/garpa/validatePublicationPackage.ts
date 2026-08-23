import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type { PublicationPackage } from "../../types/garpaPublication";

const LocatorSchema = z
  .object({
    artifactId: z.string().min(1),
    page: z.number().int().positive().optional(),
    timestampStart: z.string().optional(),
    timestampEnd: z.string().optional(),
    section: z.string().optional(),
    quotedText: z.string().optional(),
    description: z.string().optional(),
  })
  .strict();

const SupportSchema = z
  .object({
    relation: z.enum([
      "direct_source",
      "derived_from",
      "measured_by",
      "evaluated_by",
      "costed_by",
      "limited_by",
      "contradicted_by",
    ]),
    artifactId: z.string().optional(),
    evidenceCellId: z.string().optional(),
    stageReceiptId: z.string().optional(),
    runReceiptId: z.string().optional(),
    evaluationDigest: z.string().optional(),
    costLineIds: z.array(z.string()).optional(),
    locator: LocatorSchema.optional(),
    note: z.string().min(1),
  })
  .strict();

const ClaimSchema = z
  .object({
    id: z.string().min(1),
    caseId: z.string().min(1),
    text: z.string().min(1),
    claimClass: z.enum([
      "source_attribution",
      "evidence_summary",
      "local_measurement",
      "bounded_inference",
      "mission_evaluation",
      "cost_comparison",
      "vendor_parity",
      "residual",
      "open_question",
    ]),
    subject: z.string().min(1),
    scope: z
      .object({
        offeringVersion: z.string().optional(),
        buildDigest: z.string().optional(),
        scenarioIds: z.array(z.string()).optional(),
        metricIds: z.array(z.string()).optional(),
        environment: z.string().optional(),
        evaluationPeriod: z.string().optional(),
        accountingBoundaryComplete: z.boolean().optional(),
      })
      .strict(),
    supportRefs: z.array(SupportSchema),
    limitations: z.array(z.string()),
    prohibitedGeneralizations: z.array(z.string()),
    state: z.enum(["candidate", "supported", "blocked", "superseded"]),
  })
  .strict();

const RightsReviewSchema = z
  .object({
    state: z.enum([
      "clear",
      "clear_with_citation_only",
      "permission_required",
      "blocked",
    ]),
    artifactDecisions: z.array(
      z
        .object({
          artifactId: z.string().min(1),
          rightsClass: z.enum([
            "redistributable",
            "public_domain",
            "open_license",
            "quotation_only",
            "citation_only",
            "permission_required",
            "restricted",
            "unknown",
          ]),
          includedInRelease: z.boolean(),
          note: z.string(),
        })
        .strict(),
    ),
    reviewedAt: z.string().min(1),
    reviewer: z.string().min(1),
  })
  .strict();

const SafetyReviewSchema = z
  .object({
    state: z.enum([
      "clear",
      "clear_with_redactions",
      "controlled_release_only",
      "blocked",
    ]),
    findings: z.array(
      z
        .object({
          id: z.string().min(1),
          affectedClaimIds: z.array(z.string()),
          affectedArtifactIds: z.array(z.string()),
          risk: z.string().min(1),
          requiredAction: z.string().min(1),
        })
        .strict(),
    ),
    reviewedAt: z.string().min(1),
    reviewer: z.string().min(1),
  })
  .strict();

const RedactionSchema = z
  .object({
    id: z.string().min(1),
    claimId: z.string().optional(),
    artifactId: z.string().optional(),
    reason: z.enum([
      "personal_information",
      "security_sensitive_configuration",
      "operational_vulnerability",
      "restricted_source",
      "third_party_secret",
      "safety_sensitive_procedure",
      "legal_restriction",
      "other",
    ]),
    removedContentDescription: z.string().min(1),
    publicReplacement: z.string().optional(),
    evidentiaryEffect: z.enum([
      "none",
      "narrows_claim",
      "blocks_claim",
      "requires_controlled_release",
    ]),
    decidedBy: z.string().min(1),
    decidedAt: z.string().min(1),
  })
  .strict();

const PublicationPackageSchema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    releaseCandidateId: z.string().min(1),
    subject: z.string().min(1),
    caseIndexDigest: z.string().min(1),
    upstreamDigests: z.record(z.string()),
    disposition: z.enum([
      "acquire",
      "compose",
      "develop",
      "experiment",
      "wait_for_evidence",
      "decline",
      "unresolved",
    ]),
    vendorParityState: z.enum([
      "same_fixture_match",
      "same_fixture_miss",
      "evidence_only_comparison",
      "vendor_baseline_missing",
      "scenario_mismatch",
      "incomparable",
      "not_attempted",
    ]),
    claims: z.array(ClaimSchema),
    audience: z.enum(["public", "research", "controlled", "internal"]),
    rightsReview: RightsReviewSchema,
    safetyReview: SafetyReviewSchema,
    redactions: z.array(RedactionSchema),
    preparedAt: z.string().min(1),
    preparedBy: z.string().min(1),
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

function duplicateStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export function validatePublicationPackage(
  input: unknown,
): GarpaValidationResult<PublicationPackage> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  const parsed = PublicationPackageSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const publication = parsed.data as PublicationPackage;
  const errors: string[] = [];
  for (const id of duplicateStrings(publication.claims.map((claim) => claim.id))) {
    errors.push(`claims contains duplicate id "${id}".`);
  }
  for (const id of duplicateStrings(publication.redactions.map((item) => item.id))) {
    errors.push(`redactions contains duplicate id "${id}".`);
  }
  const claimIds = new Set(publication.claims.map((claim) => claim.id));
  publication.claims.forEach((claim, index) => {
    if (claim.caseId !== publication.caseId) {
      errors.push(`claims.${index}.caseId does not match the publication caseId.`);
    }
  });
  publication.redactions.forEach((redaction, index) => {
    if (redaction.claimId && !claimIds.has(redaction.claimId)) {
      errors.push(
        `redactions.${index} references unknown claim "${redaction.claimId}".`,
      );
    }
  });
  publication.safetyReview.findings.forEach((finding, index) => {
    for (const claimId of finding.affectedClaimIds) {
      if (!claimIds.has(claimId)) {
        errors.push(
          `safetyReview.findings.${index} references unknown claim "${claimId}".`,
        );
      }
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: publication };
}
