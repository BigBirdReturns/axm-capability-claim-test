import type { GarpaValidationResult } from "../../types/garpa";
import type {
  ArchitecturePattern,
  CapabilityPrimitive,
  ComponentObservation,
} from "../../types/garpaCommons";
import type {
  CommonsCatalog,
  CommonsCatalogEntry,
  CommonsCatalogObjectType,
  CommonsCatalogRevision,
  CommonsCatalogUpdateRequest,
} from "../../types/garpaCommonsCatalog";
import { computeCommonsCatalogDigest, computeCommonsObjectDigest } from "./commonsCatalogDigest";
import { validateCommonsAdmissionRequest } from "./validateCommonsAdmission";
import { commonsIdentityKey, commonsObjectId } from "./commonsCatalogIdentity";

const SHA256 = /^[a-f0-9]{64}$/i;
const OBJECT_TYPES: CommonsCatalogObjectType[] = [
  "primitive",
  "component_observation",
  "architecture_pattern",
];

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

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmpty);
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

function validateRevisionShape(
  revision: unknown,
  path: string,
): string[] {
  if (!isRecord(revision)) return [`${path} must be an object.`];
  const errors: string[] = [];
  if (!nonEmpty(revision.revisionId)) errors.push(`${path}.revisionId is required.`);
  if (!Number.isInteger(revision.revisionNumber) || Number(revision.revisionNumber) < 1) {
    errors.push(`${path}.revisionNumber must be a positive integer.`);
  }
  if (!nonEmpty(revision.objectDigest) || !SHA256.test(revision.objectDigest)) {
    errors.push(`${path}.objectDigest must be a SHA-256 hex digest.`);
  }
  if (!["current", "superseded", "withdrawn"].includes(String(revision.state))) {
    errors.push(`${path}.state is invalid.`);
  }
  if (revision.supersedesRevisionId !== undefined && !nonEmpty(revision.supersedesRevisionId)) {
    errors.push(`${path}.supersedesRevisionId must be non-empty when supplied.`);
  }
  for (const field of [
    "sourceCaseId",
    "sourceReleaseId",
    "sourceReleaseDigest",
  ]) {
    if (!nonEmpty(revision[field])) errors.push(`${path}.${field} is required.`);
  }
  if (!validDate(revision.catalogedAt)) {
    errors.push(`${path}.catalogedAt must be a valid date-time string.`);
  }
  if (
    nonEmpty(revision.sourceReleaseDigest) &&
    !SHA256.test(revision.sourceReleaseDigest)
  ) {
    errors.push(`${path}.sourceReleaseDigest must be a SHA-256 hex digest.`);
  }
  if (!("value" in revision) || !isRecord(revision.value)) {
    errors.push(`${path}.value must be an object.`);
  }
  return errors;
}

function validateEntryShape(entry: unknown, path: string): string[] {
  if (!isRecord(entry)) return [`${path} must be an object.`];
  const errors: string[] = [];
  if (!nonEmpty(entry.catalogObjectId)) errors.push(`${path}.catalogObjectId is required.`);
  if (!OBJECT_TYPES.includes(entry.objectType as CommonsCatalogObjectType)) {
    errors.push(`${path}.objectType is invalid.`);
  }
  if (!nonEmpty(entry.identityKey)) errors.push(`${path}.identityKey is required.`);
  if (!stringArray(entry.aliases)) errors.push(`${path}.aliases must contain non-empty strings.`);
  if (!Array.isArray(entry.revisions) || entry.revisions.length === 0) {
    errors.push(`${path}.revisions must contain at least one revision.`);
  } else {
    entry.revisions.forEach((revision, index) => {
      errors.push(...validateRevisionShape(revision, `${path}.revisions.${index}`));
    });
  }
  if (entry.currentRevisionId !== undefined && !nonEmpty(entry.currentRevisionId)) {
    errors.push(`${path}.currentRevisionId must be non-empty when supplied.`);
  }
  return errors;
}

function validateCatalogShape(value: unknown): string[] {
  if (!isRecord(value)) return ["Catalog must be an object."];
  const errors: string[] = [];
  if (value.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (!nonEmpty(value.catalogId)) errors.push("catalogId is required.");
  if (!Number.isInteger(value.revision) || Number(value.revision) < 0) {
    errors.push("revision must be a non-negative integer.");
  }
  for (const field of ["createdAt", "updatedAt"]) {
    if (!validDate(value[field])) errors.push(`${field} must be a valid date-time string.`);
  }
  if (!nonEmpty(value.catalogDigest) || !SHA256.test(value.catalogDigest)) {
    errors.push("catalogDigest must be a SHA-256 hex digest.");
  }
  for (const field of [
    "primitiveEntries",
    "componentObservationEntries",
    "architecturePatternEntries",
  ]) {
    const entries = value[field];
    if (!Array.isArray(entries)) errors.push(`${field} must be an array.`);
    else entries.forEach((entry, index) => errors.push(...validateEntryShape(entry, `${field}.${index}`)));
  }
  return errors;
}

function revisionSemanticErrors<T extends CapabilityPrimitive | ComponentObservation | ArchitecturePattern>(
  entry: CommonsCatalogEntry<T>,
): string[] {
  const errors: string[] = [];
  const sorted = [...entry.revisions].sort((a, b) => a.revisionNumber - b.revisionNumber);
  sorted.forEach((revision, index) => {
    if (revision.revisionNumber !== index + 1) {
      errors.push(`${entry.catalogObjectId} revision numbers must be contiguous from 1.`);
    }
    if (index === 0 && revision.supersedesRevisionId) {
      errors.push(`${entry.catalogObjectId} first revision cannot supersede another revision.`);
    }
    if (index > 0 && revision.supersedesRevisionId !== sorted[index - 1]!.revisionId) {
      errors.push(`${entry.catalogObjectId} revision ${revision.revisionId} must supersede the immediately prior revision.`);
    }
    if (index < sorted.length - 1 && revision.state !== "superseded") {
      errors.push(`${entry.catalogObjectId} non-latest revision ${revision.revisionId} must be superseded.`);
    }
    if (
      index === sorted.length - 1 &&
      !["current", "superseded", "withdrawn"].includes(revision.state)
    ) {
      errors.push(`${entry.catalogObjectId} latest revision must be current, superseded, or withdrawn.`);
    }
    if (computeCommonsObjectDigest(revision.value) !== revision.objectDigest) {
      errors.push(`${entry.catalogObjectId} revision ${revision.revisionId} object digest does not match its value.`);
    }
    if (entry.objectType === "component_observation") {
      const observation = revision.value as ComponentObservation;
      if (
        observation.sourceCaseId !== revision.sourceCaseId ||
        observation.sourceReleaseId !== revision.sourceReleaseId ||
        observation.sourceReleaseDigest !== revision.sourceReleaseDigest
      ) {
        errors.push(`${entry.catalogObjectId} revision ${revision.revisionId} source coordinates do not match the component observation.`);
      }
    } else {
      const sourced = revision.value as CapabilityPrimitive | ArchitecturePattern;
      if (
        !sourced.sourceCaseIds.includes(revision.sourceCaseId) ||
        !sourced.sourceReleaseIds.includes(revision.sourceReleaseId)
      ) {
        errors.push(`${entry.catalogObjectId} revision ${revision.revisionId} source coordinates are absent from the object lineage.`);
      }
    }
  });

  const current = entry.revisions.filter((revision) => revision.state === "current");
  const latest = sorted[sorted.length - 1]!;
  if (current.length > 1) {
    errors.push(`${entry.catalogObjectId} cannot contain more than one current revision.`);
  } else if (current.length === 1) {
    if (entry.currentRevisionId !== current[0]!.revisionId) {
      errors.push(`${entry.catalogObjectId} currentRevisionId does not match the current revision.`);
    }
  } else if (
    !["superseded", "withdrawn"].includes(latest.state) ||
    entry.currentRevisionId !== undefined
  ) {
    errors.push(`${entry.catalogObjectId} without a current revision must end in a superseded or withdrawn revision and omit currentRevisionId.`);
  }
  for (const revision of entry.revisions) {
    if (revision.state !== "current" && revision.revisionId === entry.currentRevisionId) {
      errors.push(`${entry.catalogObjectId} points to a non-current revision.`);
    }
  }
  const identityValue = current[0]?.value ?? latest.value;
  if (entry.identityKey !== commonsIdentityKey(entry.objectType, identityValue)) {
    errors.push(`${entry.catalogObjectId} identityKey does not match its governing value.`);
  }
  return errors;
}

function entryCollectionErrors<T extends CapabilityPrimitive | ComponentObservation | ArchitecturePattern>(
  entries: CommonsCatalogEntry<T>[],
  expectedType: CommonsCatalogObjectType,
): string[] {
  const errors: string[] = [];
  for (const duplicate of duplicateValues(entries.map((entry) => entry.catalogObjectId))) {
    errors.push(`${expectedType} catalog contains duplicate catalogObjectId "${duplicate}".`);
  }
  for (const duplicate of duplicateValues(entries.map((entry) => entry.identityKey))) {
    errors.push(`${expectedType} catalog contains duplicate identityKey "${duplicate}".`);
  }
  for (const entry of entries) {
    for (const duplicate of duplicateValues(entry.aliases)) {
      errors.push(`${entry.catalogObjectId} aliases contains duplicate value "${duplicate}".`);
    }
    if (entry.objectType !== expectedType) {
      errors.push(`${entry.catalogObjectId} is stored in the wrong object-type collection.`);
    }
    errors.push(...revisionSemanticErrors(entry));
  }
  return errors;
}

export function validateCommonsCatalog(
  input: unknown,
): GarpaValidationResult<CommonsCatalog> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  const shapeErrors = validateCatalogShape(raw.value);
  if (shapeErrors.length > 0) return { ok: false, errors: shapeErrors };

  const catalog = raw.value as CommonsCatalog;
  const errors: string[] = [];
  if (Date.parse(catalog.updatedAt) < Date.parse(catalog.createdAt)) {
    errors.push("updatedAt cannot precede createdAt.");
  }
  errors.push(...entryCollectionErrors(catalog.primitiveEntries, "primitive"));
  errors.push(...entryCollectionErrors(catalog.componentObservationEntries, "component_observation"));
  errors.push(...entryCollectionErrors(catalog.architecturePatternEntries, "architecture_pattern"));
  if (computeCommonsCatalogDigest(catalog) !== catalog.catalogDigest) {
    errors.push("catalogDigest does not match the canonical catalog content.");
  }
  if (errors.length > 0) return { ok: false, errors: Array.from(new Set(errors)) };
  return { ok: true, errors: [], value: catalog };
}

function validateOperationShape(operation: unknown, path: string): string[] {
  if (!isRecord(operation)) return [`${path} must be an object.`];
  const errors: string[] = [];
  for (const field of ["operationId", "incomingObjectId", "catalogObjectId", "reason"]) {
    if (!nonEmpty(operation[field])) errors.push(`${path}.${field} is required.`);
  }
  if (!OBJECT_TYPES.includes(operation.objectType as CommonsCatalogObjectType)) {
    errors.push(`${path}.objectType is invalid.`);
  }
  if (!["create", "supersede", "noop"].includes(String(operation.action))) {
    errors.push(`${path}.action is invalid.`);
  }
  if (operation.expectedCurrentRevisionId !== undefined && !nonEmpty(operation.expectedCurrentRevisionId)) {
    errors.push(`${path}.expectedCurrentRevisionId must be non-empty when supplied.`);
  }
  if (!stringArray(operation.aliasesAdded)) {
    errors.push(`${path}.aliasesAdded must contain non-empty strings.`);
  }
  return errors;
}

export function validateCommonsCatalogUpdateRequest(
  input: unknown,
): GarpaValidationResult<CommonsCatalogUpdateRequest> {
  const raw = parseInput(input);
  if (!raw.ok) return { ok: false, errors: raw.errors };
  if (!isRecord(raw.value)) return { ok: false, errors: ["Update request must be an object."] };
  const request = raw.value;
  const errors: string[] = [];
  if (request.schemaVersion !== 1) errors.push("schemaVersion must equal 1.");
  if (!nonEmpty(request.expectedCatalogDigest) || !SHA256.test(request.expectedCatalogDigest)) {
    errors.push("expectedCatalogDigest must be a SHA-256 hex digest.");
  }
  if (!nonEmpty(request.actor)) errors.push("actor is required.");
  if (!validDate(request.updatedAt)) errors.push("updatedAt must be a valid date-time string.");
  const catalog = validateCommonsCatalog(request.currentCatalog);
  errors.push(...catalog.errors.map((error) => `currentCatalog: ${error}`));
  const admission = validateCommonsAdmissionRequest(request.admissionRequest);
  errors.push(...admission.errors.map((error) => `admissionRequest: ${error}`));
  if (!isRecord(request.admissionResult)) {
    errors.push("admissionResult must be an object.");
  } else {
    for (const field of [
      "admittedPrimitiveIds",
      "admittedComponentObservationIds",
      "admittedArchitecturePatternIds",
      "blockedObjectIds",
    ]) {
      if (!stringArray(request.admissionResult[field])) {
        errors.push(`admissionResult.${field} must contain non-empty strings.`);
      }
    }
    if (typeof request.admissionResult.passed !== "boolean") {
      errors.push("admissionResult.passed must be boolean.");
    }
    if (!Array.isArray(request.admissionResult.findings)) {
      errors.push("admissionResult.findings must be an array.");
    }
  }
  if (!Array.isArray(request.operations)) errors.push("operations must be an array.");
  else request.operations.forEach((operation, index) => errors.push(...validateOperationShape(operation, `operations.${index}`)));

  if (Array.isArray(request.operations)) {
    const operations = request.operations as Array<Record<string, unknown>>;
    for (const duplicate of duplicateValues(operations.map((operation) => String(operation.operationId)))) {
      errors.push(`operations contains duplicate operationId "${duplicate}".`);
    }
  }
  if (errors.length > 0 || !catalog.value || !admission.value) {
    return { ok: false, errors: Array.from(new Set(errors)) };
  }
  return {
    ok: true,
    errors: [],
    value: {
      ...(request as unknown as CommonsCatalogUpdateRequest),
      currentCatalog: catalog.value,
      admissionRequest: admission.value,
    },
  };
}

export function currentRevision<T>(
  entry: CommonsCatalogEntry<T>,
): CommonsCatalogRevision<T> | undefined {
  return entry.revisions.find((revision) => revision.revisionId === entry.currentRevisionId);
}

export function findCatalogEntry(
  catalog: CommonsCatalog,
  objectType: CommonsCatalogObjectType,
  catalogObjectId: string,
): CommonsCatalogEntry<CapabilityPrimitive | ComponentObservation | ArchitecturePattern> | undefined {
  const entries = objectType === "primitive"
    ? catalog.primitiveEntries
    : objectType === "component_observation"
      ? catalog.componentObservationEntries
      : catalog.architecturePatternEntries;
  return entries.find((entry) => entry.catalogObjectId === catalogObjectId) as
    | CommonsCatalogEntry<CapabilityPrimitive | ComponentObservation | ArchitecturePattern>
    | undefined;
}

export function assertCatalogObjectId(
  objectType: CommonsCatalogObjectType,
  value: CapabilityPrimitive | ComponentObservation | ArchitecturePattern,
): string {
  return commonsObjectId(objectType, value);
}