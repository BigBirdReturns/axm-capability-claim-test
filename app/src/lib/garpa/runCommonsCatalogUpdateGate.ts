import type { CommonsAdmissionRequest } from "../../types/garpaCommons";
import type {
  CommonsCatalog,
  CommonsCatalogFinding,
  CommonsCatalogFindingState,
  CommonsCatalogObjectType,
  CommonsCatalogOperation,
  CommonsCatalogUpdateGateResult,
  CommonsCatalogUpdateRequest,
} from "../../types/garpaCommonsCatalog";
import { canonicalStringify } from "./canonicalJson";
import { computeCommonsCatalogDigest, computeCommonsObjectDigest } from "./commonsCatalogDigest";
import {
  commonsIdentityKey,
  commonsObjectId,
  type CommonsCatalogValue,
} from "./commonsCatalogIdentity";
import { runCommonsAdmissionGate } from "./runCommonsAdmissionGate";
import {
  currentRevision,
  findCatalogEntry,
  validateCommonsCatalog,
} from "./validateCommonsCatalog";

interface IncomingObject {
  objectType: CommonsCatalogObjectType;
  objectId: string;
  value: CommonsCatalogValue;
}

const FINDING_PRIORITY: CommonsCatalogFindingState[] = [
  "catalog_history_invalid",
  "catalog_digest_mismatch",
  "admission_result_mismatch",
  "timestamp_regression",
  "operation_coverage_incomplete",
  "blocked_object_targeted",
  "operation_target_conflict",
  "catalog_object_missing",
  "current_revision_conflict",
  "catalog_identity_conflict",
  "invalid_supersession",
  "invalid_noop",
];

function addFinding(
  findings: CommonsCatalogFinding[],
  state: CommonsCatalogFindingState,
  reason: string,
  requiredAction: string,
  operation?: CommonsCatalogOperation,
): void {
  findings.push({
    state,
    operationId: operation?.operationId,
    objectType: operation?.objectType,
    incomingObjectId: operation?.incomingObjectId,
    catalogObjectId: operation?.catalogObjectId,
    reason,
    requiredAction,
  });
}

function incomingObjects(request: CommonsAdmissionRequest): IncomingObject[] {
  return [
    ...request.primitives.map((value) => ({
      objectType: "primitive" as const,
      objectId: value.primitiveId,
      value,
    })),
    ...request.componentObservations.map((value) => ({
      objectType: "component_observation" as const,
      objectId: value.observationId,
      value,
    })),
    ...request.architecturePatterns.map((value) => ({
      objectType: "architecture_pattern" as const,
      objectId: value.patternId,
      value,
    })),
  ];
}

function admittedKeys(request: CommonsCatalogUpdateRequest): Set<string> {
  const result = request.admissionResult;
  return new Set([
    ...result.admittedPrimitiveIds.map((id) => `primitive:${id}`),
    ...result.admittedComponentObservationIds.map(
      (id) => `component_observation:${id}`,
    ),
    ...result.admittedArchitecturePatternIds.map(
      (id) => `architecture_pattern:${id}`,
    ),
  ]);
}

function blockedKeys(request: CommonsCatalogUpdateRequest): Set<string> {
  const objects = incomingObjects(request.admissionRequest);
  const keys = new Set<string>();
  for (const id of request.admissionResult.blockedObjectIds) {
    for (const item of objects.filter((candidate) => candidate.objectId === id)) {
      keys.add(`${item.objectType}:${id}`);
    }
  }
  return keys;
}

function operationKey(operation: CommonsCatalogOperation): string {
  return `${operation.objectType}:${operation.incomingObjectId}`;
}

function incomingMap(
  request: CommonsAdmissionRequest,
): Map<string, IncomingObject> {
  return new Map(
    incomingObjects(request).map((item) => [
      `${item.objectType}:${item.objectId}`,
      item,
    ]),
  );
}

function entriesForType(
  catalog: CommonsCatalog,
  objectType: CommonsCatalogObjectType,
): Array<{
  catalogObjectId: string;
  identityKey: string;
}> {
  if (objectType === "primitive") return catalog.primitiveEntries;
  if (objectType === "component_observation") {
    return catalog.componentObservationEntries;
  }
  return catalog.architecturePatternEntries;
}

function sameAdmissionResult(request: CommonsCatalogUpdateRequest): boolean {
  return canonicalStringify(runCommonsAdmissionGate(request.admissionRequest)) ===
    canonicalStringify(request.admissionResult);
}

function targetConflicts(
  operations: CommonsCatalogOperation[],
): Set<string> {
  const seen = new Set<string>();
  const conflicts = new Set<string>();
  for (const operation of operations) {
    const key = `${operation.objectType}:${operation.catalogObjectId}`;
    if (seen.has(key)) conflicts.add(key);
    seen.add(key);
  }
  return conflicts;
}

function validateOperation(
  request: CommonsCatalogUpdateRequest,
  operation: CommonsCatalogOperation,
  incoming: IncomingObject,
  findings: CommonsCatalogFinding[],
): void {
  const catalog = request.currentCatalog;
  const entry = findCatalogEntry(
    catalog,
    operation.objectType,
    operation.catalogObjectId,
  );
  const identityKey = commonsIdentityKey(operation.objectType, incoming.value);
  const objectDigest = computeCommonsObjectDigest(incoming.value);

  if (commonsObjectId(operation.objectType, incoming.value) !== operation.incomingObjectId) {
    addFinding(
      findings,
      "operation_coverage_incomplete",
      "Operation incomingObjectId does not match the identifier carried by the admitted object.",
      "Use the exact admitted object identifier.",
      operation,
    );
    return;
  }

  if (operation.action === "create") {
    if (entry) {
      addFinding(
        findings,
        "operation_target_conflict",
        "Create operation targets an existing catalog object.",
        "Use supersede or noop against the current revision, or allocate a distinct catalogObjectId.",
        operation,
      );
    }
    if (operation.expectedCurrentRevisionId) {
      addFinding(
        findings,
        "current_revision_conflict",
        "Create operation must not carry an expected current revision.",
        "Remove expectedCurrentRevisionId for a genuinely new catalog object.",
        operation,
      );
    }
    const collision = entriesForType(catalog, operation.objectType).find(
      (candidate) =>
        candidate.identityKey === identityKey &&
        candidate.catalogObjectId !== operation.catalogObjectId,
    );
    if (collision) {
      addFinding(
        findings,
        "catalog_identity_conflict",
        `Incoming object has the same stable identity as catalog object ${collision.catalogObjectId}.`,
        "Supersede the existing identity when the object is a new revision, or narrow the incoming identity until it is genuinely distinct.",
        operation,
      );
    }
    return;
  }

  if (!entry) {
    addFinding(
      findings,
      "catalog_object_missing",
      `${operation.action} operation targets an absent catalog object.`,
      "Use create for a new identity or target an existing catalogObjectId.",
      operation,
    );
    return;
  }

  const current = currentRevision(entry);
  if (!current || operation.expectedCurrentRevisionId !== current.revisionId) {
    addFinding(
      findings,
      "current_revision_conflict",
      "Operation was not prepared against the catalog object's current revision.",
      "Reload the current catalog and bind the operation to its exact currentRevisionId.",
      operation,
    );
  }
  if (identityKey !== entry.identityKey) {
    addFinding(
      findings,
      "catalog_identity_conflict",
      "Incoming object does not match the stable identity of the targeted catalog object.",
      "Create a distinct catalog object or use a separately governed identity-lineage operation.",
      operation,
    );
  }

  if (operation.action === "supersede") {
    if (current?.objectDigest === objectDigest) {
      addFinding(
        findings,
        "invalid_supersession",
        "Supersede operation does not change the canonical object content.",
        "Use noop for an idempotent replay or supply the changed admitted revision.",
        operation,
      );
    }
    return;
  }

  if (current?.objectDigest !== objectDigest) {
    addFinding(
      findings,
      "invalid_noop",
      "Noop operation does not match the current canonical object digest.",
      "Use supersede for changed content or restore the exact current object.",
      operation,
    );
  }
}

export function runCommonsCatalogUpdateGate(
  request: CommonsCatalogUpdateRequest,
): CommonsCatalogUpdateGateResult {
  const findings: CommonsCatalogFinding[] = [];
  const catalogValidation = validateCommonsCatalog(request.currentCatalog);
  if (!catalogValidation.ok) {
    addFinding(
      findings,
      "catalog_history_invalid",
      catalogValidation.errors.join(" "),
      "Repair or recover the last valid catalog before applying another update.",
    );
    return {
      passed: false,
      state: "catalog_history_invalid",
      findings,
      admittedOperationIds: [],
      noopOperationIds: [],
    };
  }

  const observedDigest = computeCommonsCatalogDigest(request.currentCatalog);
  if (
    request.expectedCatalogDigest !== request.currentCatalog.catalogDigest ||
    observedDigest !== request.currentCatalog.catalogDigest
  ) {
    addFinding(
      findings,
      "catalog_digest_mismatch",
      "The update was prepared against a different or internally inconsistent catalog digest.",
      "Reload the current content-addressed catalog and rebuild the update request.",
    );
  }
  if (!sameAdmissionResult(request)) {
    addFinding(
      findings,
      "admission_result_mismatch",
      "Supplied commons admission result does not match a fresh deterministic gate run.",
      "Re-run commons admission and use the exact resulting admitted and blocked identities.",
    );
  }
  if (
    !Number.isFinite(Date.parse(request.updatedAt)) ||
    Date.parse(request.updatedAt) < Date.parse(request.currentCatalog.updatedAt)
  ) {
    addFinding(
      findings,
      "timestamp_regression",
      "Catalog update time precedes the current catalog update time.",
      "Use a non-regressing update timestamp.",
    );
  }

  const incoming = incomingMap(request.admissionRequest);
  const admitted = admittedKeys(request);
  const blocked = blockedKeys(request);
  const operationsByIncoming = new Map<string, CommonsCatalogOperation[]>();
  for (const operation of request.operations) {
    const key = operationKey(operation);
    operationsByIncoming.set(key, [
      ...(operationsByIncoming.get(key) ?? []),
      operation,
    ]);
  }

  for (const key of admitted) {
    const operations = operationsByIncoming.get(key) ?? [];
    if (operations.length !== 1) {
      addFinding(
        findings,
        "operation_coverage_incomplete",
        `Admitted object ${key} must have exactly one catalog operation; found ${operations.length}.`,
        "Add one create, supersede, or noop operation for every admitted object.",
      );
    }
  }
  for (const [key, operations] of operationsByIncoming) {
    if (!admitted.has(key)) {
      const operation = operations[0];
      addFinding(
        findings,
        blocked.has(key)
          ? "blocked_object_targeted"
          : "operation_coverage_incomplete",
        blocked.has(key)
          ? `Catalog operation targets blocked object ${key}.`
          : `Catalog operation targets object ${key}, which was not admitted.`,
        "Apply catalog operations only to the object identifiers emitted in the admitted arrays.",
        operation,
      );
    }
    if (operations.length > 1) {
      for (const operation of operations) {
        addFinding(
          findings,
          "operation_coverage_incomplete",
          `Object ${key} has multiple catalog operations in one update.`,
          "Collapse the request to one operation per admitted object.",
          operation,
        );
      }
    }
  }

  const plannedIdentityGroups = new Map<string, CommonsCatalogOperation[]>();
  for (const operation of request.operations) {
    const item = incoming.get(operationKey(operation));
    if (!item || !admitted.has(operationKey(operation))) continue;
    const key = `${operation.objectType}:${commonsIdentityKey(operation.objectType, item.value)}`;
    plannedIdentityGroups.set(key, [
      ...(plannedIdentityGroups.get(key) ?? []),
      operation,
    ]);
  }
  for (const operations of plannedIdentityGroups.values()) {
    const targets = new Set(operations.map((operation) => operation.catalogObjectId));
    if (targets.size <= 1) continue;
    for (const operation of operations) {
      addFinding(
        findings,
        "catalog_identity_conflict",
        "Multiple admitted objects with the same stable identity target different catalog objects in one update.",
        "Merge them into one governed revision chain or narrow the object identities before cataloging.",
        operation,
      );
    }
  }

  const conflicts = targetConflicts(request.operations);
  for (const operation of request.operations) {
    const targetKey = `${operation.objectType}:${operation.catalogObjectId}`;
    if (conflicts.has(targetKey)) {
      addFinding(
        findings,
        "operation_target_conflict",
        `Multiple mutating operations target ${targetKey} in the same catalog update.`,
        "Serialize revisions so each catalog object receives at most one mutating operation per catalog revision.",
        operation,
      );
    }
    const item = incoming.get(operationKey(operation));
    if (item && admitted.has(operationKey(operation))) {
      validateOperation(request, operation, item, findings);
    }
  }

  const state = FINDING_PRIORITY.find((candidate) =>
    findings.some((finding) => finding.state === candidate),
  );
  if (state) {
    return {
      passed: false,
      state,
      findings,
      admittedOperationIds: [],
      noopOperationIds: [],
    };
  }

  const admittedOperationIds = request.operations
    .filter((operation) => operation.action !== "noop")
    .map((operation) => operation.operationId);
  const noopOperationIds = request.operations
    .filter((operation) => operation.action === "noop")
    .map((operation) => operation.operationId);
  return {
    passed: true,
    state: admittedOperationIds.length === 0
      ? "catalog_noop"
      : "catalog_update_admitted",
    findings: [],
    admittedOperationIds,
    noopOperationIds,
  };
}
