import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type {
  CounterevidencePacket,
  CounterevidenceReviewRequest,
} from "../../types/garpaCounterevidence";

const SHA256 = /^[a-f0-9]{64}$/i;

const PacketSchema = z
  .object({
    schemaVersion: z.literal(1),
    packetId: z.string().min(1),
    targetCaseId: z.string().min(1),
    targetReleaseId: z.string().min(1),
    targetReleaseDigest: z.string().regex(SHA256),
    targetClaimIds: z.array(z.string().min(1)).min(1),
    submitter: z
      .object({
        name: z.string().optional(),
        organization: z.string().optional(),
        relationshipToSubject: z.enum([
          "public",
          "customer",
          "vendor",
          "investor",
          "employee",
          "researcher",
          "operator",
          "unknown",
        ]),
      })
      .strict(),
    artifactIds: z.array(z.string().min(1)).min(1),
    evidenceCellIds: z.array(z.string().min(1)).min(1),
    requestedCorrection: z.string().min(1),
    submittedAt: z.string().min(1),
  })
  .strict();

const RequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    packet: PacketSchema,
    currentReleaseId: z.string().min(1),
    currentReleaseDigest: z.string().regex(SHA256),
    currentReleaseNumber: z.number().int().positive(),
    currentReleaseState: z.enum(["current", "superseded", "withdrawn"]),
    knownClaimIds: z.array(z.string().min(1)),
    validatedEvidenceCellIds: z.array(z.string().min(1)),
    duplicateEvidenceCellIds: z.array(z.string().min(1)),
    rejectedEvidenceCellIds: z.array(z.string().min(1)),
    claimAssessments: z.array(
      z
        .object({
          claimId: z.string().min(1),
          effect: z.enum([
            "supports",
            "narrows",
            "contradicts",
            "requires_requalification",
            "new_offering_version",
            "no_effect",
          ]),
          evidenceCellIds: z.array(z.string().min(1)),
          reason: z.string().min(1),
        })
        .strict(),
    ),
    reviewedAt: z.string().min(1),
    reviewer: z.string().min(1),
  })
  .strict();

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

function parseInput(input: unknown): GarpaValidationResult<unknown> {
  if (typeof input !== "string") return { ok: true, errors: [], value: input };
  try {
    return { ok: true, errors: [], value: JSON.parse(input) as unknown };
  } catch (error) {
    return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
  }
}

export function validateCounterevidencePacket(
  input: unknown,
): GarpaValidationResult<CounterevidencePacket> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  const parsed = PacketSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const packet = parsed.data;
  const errors: string[] = [];
  for (const id of duplicates(packet.targetClaimIds)) {
    errors.push(`targetClaimIds contains duplicate claim "${id}".`);
  }
  for (const id of duplicates(packet.artifactIds)) {
    errors.push(`artifactIds contains duplicate artifact "${id}".`);
  }
  for (const id of duplicates(packet.evidenceCellIds)) {
    errors.push(`evidenceCellIds contains duplicate evidence cell "${id}".`);
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: packet as CounterevidencePacket };
}

export function validateCounterevidenceReviewRequest(
  input: unknown,
): GarpaValidationResult<CounterevidenceReviewRequest> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  const parsed = RequestSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const packetResult = validateCounterevidencePacket(parsed.data.packet);
  if (!packetResult.ok || !packetResult.value) {
    return {
      ok: false,
      errors: packetResult.errors.map((error) => `packet: ${error}`),
    };
  }

  const request = parsed.data;
  const packet = packetResult.value;
  const errors: string[] = [];
  const packetEvidence = new Set(packet.evidenceCellIds);
  const knownClaims = new Set(request.knownClaimIds);
  const targetClaims = new Set(packet.targetClaimIds);

  for (const label of [
    "knownClaimIds",
    "validatedEvidenceCellIds",
    "duplicateEvidenceCellIds",
    "rejectedEvidenceCellIds",
  ] as const) {
    for (const id of duplicates(request[label])) {
      errors.push(`${label} contains duplicate id "${id}".`);
    }
  }
  for (const id of duplicates(request.claimAssessments.map((item) => item.claimId))) {
    errors.push(`claimAssessments contains duplicate claim "${id}".`);
  }

  const evidencePartitions = [
    new Set(request.validatedEvidenceCellIds),
    new Set(request.duplicateEvidenceCellIds),
    new Set(request.rejectedEvidenceCellIds),
  ];
  for (const id of packet.evidenceCellIds) {
    const count = evidencePartitions.filter((partition) => partition.has(id)).length;
    if (count > 1) {
      errors.push(`Evidence cell "${id}" appears in more than one review partition.`);
    }
  }
  for (const id of [
    ...request.validatedEvidenceCellIds,
    ...request.duplicateEvidenceCellIds,
    ...request.rejectedEvidenceCellIds,
  ]) {
    if (!packetEvidence.has(id)) {
      errors.push(`Review partition references evidence cell "${id}" absent from the packet.`);
    }
  }

  for (const claimId of packet.targetClaimIds) {
    if (!knownClaims.has(claimId)) {
      errors.push(`Packet targets unknown current claim "${claimId}".`);
    }
  }
  for (const assessment of request.claimAssessments) {
    if (!knownClaims.has(assessment.claimId) || !targetClaims.has(assessment.claimId)) {
      errors.push(`Assessment references claim "${assessment.claimId}" outside the target claim set.`);
    }
    for (const evidenceId of assessment.evidenceCellIds) {
      if (!packetEvidence.has(evidenceId)) {
        errors.push(
          `Assessment for ${assessment.claimId} references evidence "${evidenceId}" absent from the packet.`,
        );
      }
    }
    if (
      assessment.effect !== "no_effect" &&
      !assessment.evidenceCellIds.some((id) =>
        request.validatedEvidenceCellIds.includes(id),
      )
    ) {
      errors.push(
        `Assessment effect ${assessment.effect} for ${assessment.claimId} requires validated evidence.`,
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    value: {
      ...request,
      packet,
    } as CounterevidenceReviewRequest,
  };
}
