import type { GarpaValidationResult } from "../../types/garpa";
import type {
  CommonsCompatibilityAdmissionReceipt,
  CommonsComponentProjectionRequest,
  TargetComponentEvidencePacket,
} from "../../types/garpaCommonsProjection";
import { verifyCompatibilityAdmissionReceipt } from "./commonsProjectionDigest";
import { validateCommonsCatalog } from "./validateCommonsCatalog";

const SHA256 = /^[a-f0-9]{64}$/i;
const EXECUTION_CLASSES = [
  "E0_analysis_only",
  "E1_simulation_or_replay",
  "E2_bench_passive",
  "E3_controlled_field_inert",
  "E4_regulated_active",
  "E5_operational_environment",
] as const;
const COMPONENT_KINDS = [
  "commercial_hardware",
  "open_hardware",
  "software_package",
  "open_source_project",
  "service",
  "human_role",
  "custom_code",
  "custom_fabrication",
  "test_equipment",
  "external_dependency",
] as const;

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

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmpty);
}

function stringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every(nonEmpty);
}

function validDate(value: unknown): value is string {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}

function validateReceipt(
  value: unknown,
): { errors: string[]; value?: CommonsCompatibilityAdmissionReceipt } {
  if (!isRecord(value)) return { errors: ["compatibilityAdmissionReceipt must be an object."] };
  const errors: string[] = [];
  for (const field of [
    "receiptId",
    "receiptDigest",
    "targetCaseId",
    "targetMissionOutcomeDigest",
    "targetCapabilityGraphDigest",
    "nominationId",
    "catalogObjectId",
    "revisionId",
    "objectDigest",
    "sourceCaseId",
    "sourceReleaseId",
    "sourceReleaseDigest",
  ]) {
    if (!nonEmpty(value[field])) errors.push(`compatibilityAdmissionReceipt.${field} is required.`);
  }
  for (const field of [
    "receiptDigest",
    "targetMissionOutcomeDigest",
    "targetCapabilityGraphDigest",
    "objectDigest",
    "sourceReleaseDigest",
  ]) {
    if (nonEmpty(value[field]) && !SHA256.test(value[field] as string)) {
      errors.push(`compatibilityAdmissionReceipt.${field} must be a SHA-256 hex digest.`);
    }
  }
  if (value.disposition !== "compatibility_admitted") {
    errors.push("compatibilityAdmissionReceipt.disposition must be compatibility_admitted.");
  }
  if (!EXECUTION_CLASSES.includes(value.targetExecutionClass as (typeof EXECUTION_CLASSES)[number])) {
    errors.push("compatibilityAdmissionReceipt.targetExecutionClass is invalid.");
  }
  for (const field of [
    "targetFunctionIds",
    "targetInterfaceIds",
    "targetIdentityReceiptIds",
    "targetCompatibilityReceiptIds",
    "targetEnvironmentReceiptIds",
    "targetQualificationReceiptIds",
  ]) {
    if (!stringArray(value[field])) {
      errors.push(`compatibilityAdmissionReceipt.${field} must contain non-empty strings.`);
    }
  }
  if (stringArray(value.targetFunctionIds) && value.targetFunctionIds.length === 0) {
    errors.push("compatibilityAdmissionReceipt.targetFunctionIds must not be empty.");
  }
  if (stringArray(value.targetInterfaceIds) && value.targetInterfaceIds.length === 0) {
    errors.push("compatibilityAdmissionReceipt.targetInterfaceIds must not be empty.");
  }
  const typed = value as unknown as CommonsCompatibilityAdmissionReceipt;
  if (errors.length === 0 && !verifyCompatibilityAdmissionReceipt(typed)) {
    errors.push("compatibilityAdmissionReceipt digest is invalid.");
  }
  return errors.length > 0 ? { errors } : { errors: [], value: typed };
}

function validateEvidence(
  value: unknown,
): { errors: string[]; value?: TargetComponentEvidencePacket } {
  if (!isRecord(value)) return { errors: ["targetEvidence must be an object."] };
  const errors: string[] = [];
  if (!nonEmpty(value.targetCaseId)) errors.push("targetEvidence.targetCaseId is required.");
  if (!COMPONENT_KINDS.includes(value.componentKind as (typeof COMPONENT_KINDS)[number])) {
    errors.push("targetEvidence.componentKind is invalid.");
  }
  for (const field of [
    "identityEvidenceCellIds",
    "performanceEvidenceCellIds",
    "licenseEvidenceCellIds",
    "operatingRequirementEvidenceCellIds",
    "securityEvidenceCellIds",
    "securityNotes",
    "integrationRequirements",
    "limitations",
    "residuals",
  ]) {
    if (!stringArray(value[field])) errors.push(`targetEvidence.${field} must contain non-empty strings.`);
  }
  for (const field of ["performanceEnvelope", "operatingRequirements"]) {
    if (!stringRecord(value[field])) {
      errors.push(`targetEvidence.${field} must be a string-to-string object.`);
    }
  }
  if (value.license !== undefined && !nonEmpty(value.license)) {
    errors.push("targetEvidence.license must be non-empty when supplied.");
  }
  if (value.licenseNotApplicable !== undefined && typeof value.licenseNotApplicable !== "boolean") {
    errors.push("targetEvidence.licenseNotApplicable must be boolean when supplied.");
  }
  if (value.license !== undefined && value.licenseNotApplicable === true) {
    errors.push("targetEvidence cannot declare both a license and licenseNotApplicable.");
  }
  if (value.sourceAvailability !== undefined && !nonEmpty(value.sourceAvailability)) {
    errors.push("targetEvidence.sourceAvailability must be non-empty when supplied.");
  }
  return errors.length > 0
    ? { errors }
    : { errors: [], value: value as unknown as TargetComponentEvidencePacket };
}

export function validateCommonsComponentProjectionRequest(
  input: unknown,
): GarpaValidationResult<CommonsComponentProjectionRequest> {
  const parsed = parseInput(input);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  if (!isRecord(parsed.value)) return { ok: false, errors: ["Projection request must be an object."] };
  const raw = parsed.value;
  const errors: string[] = [];
  if (raw.schemaVersion !== 1) errors.push("schemaVersion must be 1.");
  for (const field of ["projectionId", "targetComponentId", "expectedCatalogDigest"]) {
    if (!nonEmpty(raw[field])) errors.push(`${field} is required.`);
  }
  if (nonEmpty(raw.expectedCatalogDigest) && !SHA256.test(raw.expectedCatalogDigest)) {
    errors.push("expectedCatalogDigest must be a SHA-256 hex digest.");
  }
  if (typeof raw.economicBoundaryRequired !== "boolean") {
    errors.push("economicBoundaryRequired must be boolean.");
  }
  if (!validDate(raw.createdAt)) errors.push("createdAt must be a valid date-time string.");

  const catalog = validateCommonsCatalog(raw.catalog);
  errors.push(...catalog.errors.map((error) => `catalog: ${error}`));
  const receipt = validateReceipt(raw.compatibilityAdmissionReceipt);
  errors.push(...receipt.errors);
  const evidence = validateEvidence(raw.targetEvidence);
  errors.push(...evidence.errors);

  if (errors.length > 0 || !catalog.value || !receipt.value || !evidence.value) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }
  return {
    ok: true,
    errors: [],
    value: {
      ...(raw as unknown as CommonsComponentProjectionRequest),
      catalog: catalog.value,
      compatibilityAdmissionReceipt: receipt.value,
      targetEvidence: evidence.value,
    },
  };
}
