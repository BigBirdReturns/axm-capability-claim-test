import { z } from "zod";
import type { GarpaValidationResult } from "../../types/garpa";
import type {
  PublicCaseRegistryEntry,
  RegistryReleaseUpdateRequest,
} from "../../types/garpaRegistry";
import { validateReleaseManifest } from "./validateReleaseManifest";

const SHA256 = /^[a-f0-9]{64}$/i;

const caseState = z.enum([
  "created",
  "evidence_blocked",
  "goal_admitted",
  "architecture_candidate",
  "qualification_frozen",
  "build_assembled",
  "evaluation_complete",
  "publication_ready",
  "superseded",
  "withdrawn",
]);

const disposition = z.enum([
  "acquire",
  "compose",
  "develop",
  "experiment",
  "wait_for_evidence",
  "decline",
  "unresolved",
]);

const VersionSchema = z
  .object({
    versionId: z.string().min(1),
    label: z.string().min(1),
    exactVersion: z.string().optional(),
    firstSeenAt: z.string().min(1),
    lastSeenAt: z.string().optional(),
    sourceArtifactIds: z.array(z.string().min(1)),
    state: z.enum(["current", "superseded", "unknown"]),
  })
  .strict();

const LineageSchema = z
  .object({
    id: z.string().min(1),
    fromSubject: z.string().min(1),
    toSubject: z.string().min(1),
    relation: z.enum([
      "same_offering",
      "rebrand",
      "successor",
      "predecessor",
      "acquired_brand",
      "organizational_transfer",
    ]),
    effectiveAt: z.string().optional(),
    sourceArtifactIds: z.array(z.string().min(1)).min(1),
    note: z.string().min(1),
  })
  .strict();

const ReleaseRecordSchema = z
  .object({
    releaseId: z.string().min(1),
    releaseNumber: z.number().int().positive(),
    manifestDigest: z.string().regex(SHA256),
    state: z.enum(["current", "superseded", "withdrawn"]),
    priorReleaseDigest: z.string().regex(SHA256).optional(),
    supersedesReleaseId: z.string().optional(),
    createdAt: z.string().min(1),
  })
  .strict();

const EntrySchema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string().min(1),
    canonicalSubject: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    claimant: z.string().optional(),
    organization: z.string().optional(),
    offering: z.string().optional(),
    versions: z.array(VersionSchema),
    lineage: z.array(LineageSchema),
    domainTags: z.array(z.string().min(1)),
    capabilityTags: z.array(z.string().min(1)),
    currentState: caseState,
    currentDisposition: disposition.optional(),
    releases: z.array(ReleaseRecordSchema),
    currentReleaseId: z.string().optional(),
    currentReleaseDigest: z.string().regex(SHA256).optional(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strict();

const IdentityPatchSchema = z
  .object({
    canonicalSubject: z.string().min(1),
    aliasesAdded: z.array(z.string().min(1)),
    claimant: z.string().optional(),
    organization: z.string().optional(),
    offering: z.string().optional(),
    versionsAdded: z.array(VersionSchema),
    lineageLinksAdded: z.array(LineageSchema),
    domainTagsAdded: z.array(z.string().min(1)),
    capabilityTagsAdded: z.array(z.string().min(1)),
  })
  .strict();

const UpdateSchema = z
  .object({
    schemaVersion: z.literal(1),
    currentEntry: EntrySchema,
    candidateRelease: z.unknown(),
    releaseVerificationState: z.enum([
      "current_valid",
      "superseded_valid",
      "withdrawn_valid",
    ]),
    expectedCurrentReleaseId: z.string().optional(),
    expectedCurrentReleaseDigest: z.string().regex(SHA256).optional(),
    identityPatch: IdentityPatchSchema,
    candidateCaseState: caseState,
    candidateDisposition: disposition.optional(),
    updatedAt: z.string().min(1),
  })
  .strict();

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

function parseInput(input: unknown): GarpaValidationResult<unknown> {
  if (typeof input !== "string") return { ok: true, errors: [], value: input };
  try {
    return { ok: true, errors: [], value: JSON.parse(input) as unknown };
  } catch (error) {
    return { ok: false, errors: [`Invalid JSON: ${(error as Error).message}`] };
  }
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

function entrySemanticErrors(entry: PublicCaseRegistryEntry): string[] {
  const errors: string[] = [];
  for (const [label, values] of [
    ["aliases", entry.aliases],
    ["versionIds", entry.versions.map((item) => item.versionId)],
    ["lineageIds", entry.lineage.map((item) => item.id)],
    ["releaseIds", entry.releases.map((item) => item.releaseId)],
    ["releaseDigests", entry.releases.map((item) => item.manifestDigest)],
    ["domainTags", entry.domainTags],
    ["capabilityTags", entry.capabilityTags],
  ] as const) {
    for (const value of duplicates([...values])) {
      errors.push(`${label} contains duplicate value "${value}".`);
    }
  }

  const currentReleases = entry.releases.filter((release) => release.state === "current");
  if (currentReleases.length > 1) {
    errors.push("Registry entry contains more than one current release.");
  }
  if (entry.currentReleaseId || entry.currentReleaseDigest) {
    if (!entry.currentReleaseId || !entry.currentReleaseDigest) {
      errors.push("currentReleaseId and currentReleaseDigest must be supplied together.");
    }
    const current = currentReleases[0];
    if (
      !current ||
      current.releaseId !== entry.currentReleaseId ||
      current.manifestDigest !== entry.currentReleaseDigest
    ) {
      errors.push("Current release pointers do not match the current release record.");
    }
  } else if (currentReleases.length > 0) {
    errors.push("A current release record exists without current release pointers.");
  }

  const releaseNumbers = entry.releases.map((release) => release.releaseNumber);
  for (const value of duplicates(releaseNumbers.map(String))) {
    errors.push(`releases contains duplicate releaseNumber "${value}".`);
  }
  if (releaseNumbers.length > 0) {
    const sorted = [...releaseNumbers].sort((a, b) => a - b);
    sorted.forEach((number, index) => {
      if (number !== index + 1) {
        errors.push("Release numbers must form a contiguous sequence beginning at 1.");
      }
    });
  }

  const currentVersions = entry.versions.filter((version) => version.state === "current");
  if (currentVersions.length > 1) {
    errors.push("Registry entry contains more than one current offering version.");
  }

  return Array.from(new Set(errors));
}

export function validatePublicCaseRegistryEntry(
  input: unknown,
): GarpaValidationResult<PublicCaseRegistryEntry> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  const parsed = EntrySchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const entry = parsed.data as PublicCaseRegistryEntry;
  const errors = entrySemanticErrors(entry);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: entry };
}

export function validateRegistryReleaseUpdateRequest(
  input: unknown,
): GarpaValidationResult<RegistryReleaseUpdateRequest> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  const parsed = UpdateSchema.safeParse(raw.value);
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };

  const entry = validatePublicCaseRegistryEntry(parsed.data.currentEntry);
  const release = validateReleaseManifest(parsed.data.candidateRelease);
  const errors = [
    ...entry.errors.map((error) => `currentEntry: ${error}`),
    ...release.errors.map((error) => `candidateRelease: ${error}`),
  ];
  if (!entry.value || !release.value || errors.length > 0) {
    return { ok: false, errors };
  }

  const patch = parsed.data.identityPatch;
  for (const [label, values] of [
    ["aliasesAdded", patch.aliasesAdded],
    ["versionsAdded", patch.versionsAdded.map((item) => item.versionId)],
    ["lineageLinksAdded", patch.lineageLinksAdded.map((item) => item.id)],
    ["domainTagsAdded", patch.domainTagsAdded],
    ["capabilityTagsAdded", patch.capabilityTagsAdded],
  ] as const) {
    for (const value of duplicates([...values])) {
      errors.push(`${label} contains duplicate value "${value}".`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    value: {
      ...parsed.data,
      currentEntry: entry.value,
      candidateRelease: release.value,
    } as RegistryReleaseUpdateRequest,
  };
}
