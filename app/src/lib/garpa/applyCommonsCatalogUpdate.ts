import type {
  ArchitecturePattern,
  CapabilityPrimitive,
  ComponentObservation,
} from "../../types/garpaCommons";
import type {
  CommonsCatalog,
  CommonsCatalogEntry,
  CommonsCatalogObjectType,
  CommonsCatalogOperation,
  CommonsCatalogRevision,
  CommonsCatalogUpdateRequest,
  CommonsCatalogUpdateResult,
} from "../../types/garpaCommonsCatalog";
import { computeCommonsCatalogDigest, computeCommonsObjectDigest } from "./commonsCatalogDigest";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";
import {
  commonsIdentityKey,
  commonsSourceCoordinates,
  type CommonsCatalogValue,
} from "./commonsCatalogIdentity";
import { runCommonsCatalogUpdateGate } from "./runCommonsCatalogUpdateGate";
import { currentRevision, findCatalogEntry } from "./validateCommonsCatalog";

interface IncomingObject {
  objectType: CommonsCatalogObjectType;
  objectId: string;
  value: CommonsCatalogValue;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function incomingObjects(request: CommonsCatalogUpdateRequest): Map<string, IncomingObject> {
  const result = new Map<string, IncomingObject>();
  for (const value of request.admissionRequest.primitives) {
    result.set(`primitive:${value.primitiveId}`, {
      objectType: "primitive",
      objectId: value.primitiveId,
      value,
    });
  }
  for (const value of request.admissionRequest.componentObservations) {
    result.set(`component_observation:${value.observationId}`, {
      objectType: "component_observation",
      objectId: value.observationId,
      value,
    });
  }
  for (const value of request.admissionRequest.architecturePatterns) {
    result.set(`architecture_pattern:${value.patternId}`, {
      objectType: "architecture_pattern",
      objectId: value.patternId,
      value,
    });
  }
  return result;
}

function revisionFor(
  request: CommonsCatalogUpdateRequest,
  operation: CommonsCatalogOperation,
  value: CommonsCatalogValue,
  revisionNumber: number,
  supersedesRevisionId?: string,
): CommonsCatalogRevision<CommonsCatalogValue> {
  const source = commonsSourceCoordinates(operation.objectType, value, {
    sourceCaseId: request.admissionRequest.sourceCaseId,
    sourceReleaseId: request.admissionRequest.sourceReleaseId,
    sourceReleaseDigest: request.admissionRequest.sourceReleaseDigest,
  });
  return {
    revisionId: `${operation.catalogObjectId}@${revisionNumber}`,
    revisionNumber,
    objectDigest: computeCommonsObjectDigest(value),
    state: "current",
    supersedesRevisionId,
    ...source,
    catalogedAt: request.updatedAt,
    value: clone(value),
  };
}

function addEntry(
  catalog: CommonsCatalog,
  request: CommonsCatalogUpdateRequest,
  operation: CommonsCatalogOperation,
  value: CommonsCatalogValue,
): void {
  const revision = revisionFor(request, operation, value, 1);
  const entry: CommonsCatalogEntry<CommonsCatalogValue> = {
    catalogObjectId: operation.catalogObjectId,
    objectType: operation.objectType,
    identityKey: commonsIdentityKey(operation.objectType, value),
    aliases: Array.from(new Set(operation.aliasesAdded)),
    revisions: [revision],
    currentRevisionId: revision.revisionId,
  };
  if (operation.objectType === "primitive") {
    catalog.primitiveEntries.push(entry as CommonsCatalogEntry<CapabilityPrimitive>);
  } else if (operation.objectType === "component_observation") {
    catalog.componentObservationEntries.push(
      entry as CommonsCatalogEntry<ComponentObservation>,
    );
  } else {
    catalog.architecturePatternEntries.push(
      entry as CommonsCatalogEntry<ArchitecturePattern>,
    );
  }
}

function applyCreate(
  catalog: CommonsCatalog,
  request: CommonsCatalogUpdateRequest,
  operation: CommonsCatalogOperation,
  value: CommonsCatalogValue,
): void {
  addEntry(catalog, request, operation, value);
}

function applySupersede(
  catalog: CommonsCatalog,
  request: CommonsCatalogUpdateRequest,
  operation: CommonsCatalogOperation,
  value: CommonsCatalogValue,
): void {
  const entry = findCatalogEntry(catalog, operation.objectType, operation.catalogObjectId);
  if (!entry) return;
  const current = currentRevision(entry);
  if (!current) return;
  current.state = "superseded";
  const nextNumber = Math.max(...entry.revisions.map((revision) => revision.revisionNumber)) + 1;
  const revision = revisionFor(
    request,
    operation,
    value,
    nextNumber,
    current.revisionId,
  );
  entry.revisions.push(revision);
  entry.currentRevisionId = revision.revisionId;
  entry.aliases = Array.from(new Set([...entry.aliases, ...operation.aliasesAdded]));
}

export function applyCommonsCatalogUpdate(
  request: CommonsCatalogUpdateRequest,
): CommonsCatalogUpdateResult {
  const gate = runCommonsCatalogUpdateGate(request);
  if (!gate.passed) {
    return {
      gate,
      appliedOperationIds: [],
      noopOperationIds: [],
    };
  }

  const catalog = clone(request.currentCatalog);
  const incoming = incomingObjects(request);
  for (const operation of request.operations) {
    if (operation.action === "noop") continue;
    const item = incoming.get(`${operation.objectType}:${operation.incomingObjectId}`);
    if (!item) continue;
    if (operation.action === "create") {
      applyCreate(catalog, request, operation, item.value);
    } else {
      applySupersede(catalog, request, operation, item.value);
    }
  }

  if (gate.admittedOperationIds.length > 0) {
    catalog.revision += 1;
    catalog.updatedAt = request.updatedAt;
    catalog.catalogDigest = computeCommonsCatalogDigest(catalog);
  }

  const receiptIdentity = sha256Hex(
    canonicalStringify({
      catalogId: catalog.catalogId,
      priorCatalogDigest: request.currentCatalog.catalogDigest,
      actor: request.actor,
      updatedAt: request.updatedAt,
      operations: request.operations,
    }),
  );
  const receipt = {
    receiptId: `${catalog.catalogId}:update:${receiptIdentity.slice(0, 16)}`,
    catalogId: catalog.catalogId,
    priorCatalogRevision: request.currentCatalog.revision,
    resultingCatalogRevision: catalog.revision,
    priorCatalogDigest: request.currentCatalog.catalogDigest,
    resultingCatalogDigest: catalog.catalogDigest,
    sourceCaseId: request.admissionRequest.sourceCaseId,
    sourceReleaseId: request.admissionRequest.sourceReleaseId,
    sourceReleaseDigest: request.admissionRequest.sourceReleaseDigest,
    actor: request.actor,
    updatedAt: request.updatedAt,
    appliedOperationIds: gate.admittedOperationIds,
    noopOperationIds: gate.noopOperationIds,
  };

  return {
    gate,
    catalog,
    receipt,
    appliedOperationIds: gate.admittedOperationIds,
    noopOperationIds: gate.noopOperationIds,
  };
}
