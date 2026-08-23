import type {
  ArchitecturePattern,
  CapabilityPrimitive,
  ComponentObservation,
  ExecutionClass,
} from "../../types/garpaCommons";
import type {
  CommonsCatalog,
  CommonsCatalogEntry,
  CommonsCatalogObjectType,
  CommonsCatalogRevision,
  CommonsCatalogSearchHit,
  CommonsCatalogSearchQuery,
  CommonsCatalogSearchResult,
} from "../../types/garpaCommonsCatalog";
import { normalizeCommonsIdentity } from "./commonsCatalogIdentity";

interface RevisionCandidate {
  objectType: CommonsCatalogObjectType;
  entry: CommonsCatalogEntry<CapabilityPrimitive | ComponentObservation | ArchitecturePattern>;
  revision: CommonsCatalogRevision<CapabilityPrimitive | ComponentObservation | ArchitecturePattern>;
}

function valuesIntersect(left: string[] | undefined, right: string[]): boolean {
  if (!left || left.length === 0) return true;
  const normalized = new Set(right.map(normalizeCommonsIdentity));
  return left.some((value) => normalized.has(normalizeCommonsIdentity(value)));
}

function textFields(candidate: RevisionCandidate): Record<string, string> {
  const value = candidate.revision.value;
  const common = {
    catalogObjectId: candidate.entry.catalogObjectId,
    aliases: candidate.entry.aliases.join(" "),
    sourceCaseId: candidate.revision.sourceCaseId,
    sourceReleaseId: candidate.revision.sourceReleaseId,
  };
  if (candidate.objectType === "primitive") {
    const primitive = value as CapabilityPrimitive;
    return {
      ...common,
      name: primitive.name,
      purpose: primitive.purpose,
      functionClass: primitive.functionClass,
      constraints: primitive.operatingConstraints.join(" "),
      humanRoles: primitive.humanRoles.join(" "),
      residuals: primitive.residuals.join(" "),
      falsificationConditions: primitive.falsificationConditions.join(" "),
    };
  }
  if (candidate.objectType === "component_observation") {
    const observation = value as ComponentObservation;
    return {
      ...common,
      manufacturer: observation.componentIdentity.manufacturer ?? "",
      product: observation.componentIdentity.product,
      exactModelOrVersion: observation.componentIdentity.exactModelOrVersion,
      firmwareOrSoftwareVersion:
        observation.componentIdentity.firmwareOrSoftwareVersion ?? "",
      fixture: observation.fixture,
      environment: Object.entries(observation.environment)
        .map(([key, item]) => `${key} ${item}`)
        .join(" "),
      functions: observation.functionIds.join(" "),
      interfaces: observation.interfaceIds.join(" "),
      residuals: observation.residuals.join(" "),
      limitations: observation.limitations.join(" "),
    };
  }
  const pattern = value as ArchitecturePattern;
  return {
    ...common,
    name: pattern.name,
    problemShape: pattern.problemShape,
    functionRoles: pattern.functionRoles.join(" "),
    interfaceRoles: pattern.interfaceRoles.join(" "),
    constraints: pattern.applicableConstraints.join(" "),
    failureModes: pattern.failureModes.join(" "),
    residuals: pattern.residuals.join(" "),
  };
}

function textMatches(
  candidate: RevisionCandidate,
  text: string | undefined,
): string[] | null {
  const query = normalizeCommonsIdentity(text);
  if (!query) return [];
  const tokens = query.split(" ").filter(Boolean);
  const fields = textFields(candidate);
  const normalizedFields = Object.entries(fields).map(([field, value]) => [
    field,
    normalizeCommonsIdentity(value),
  ] as const);
  if (!tokens.every((token) => normalizedFields.some(([, value]) => value.includes(token)))) {
    return null;
  }
  return normalizedFields
    .filter(([, value]) => tokens.some((token) => value.includes(token)))
    .map(([field]) => field);
}

function executionClasses(
  candidate: RevisionCandidate,
): ExecutionClass[] {
  const value = candidate.revision.value;
  if (candidate.objectType === "primitive") {
    return (value as CapabilityPrimitive).qualificationRefs.map(
      (ref) => ref.executionClass,
    );
  }
  if (candidate.objectType === "component_observation") {
    const observed = (value as ComponentObservation).executionClass;
    return observed ? [observed] : [];
  }
  return (value as ArchitecturePattern).qualificationRefs.map(
    (ref) => ref.executionClass,
  );
}

function matchesFilters(
  candidate: RevisionCandidate,
  query: CommonsCatalogSearchQuery,
): boolean {
  const value = candidate.revision.value;
  if (query.objectTypes?.length && !query.objectTypes.includes(candidate.objectType)) {
    return false;
  }
  if (!valuesIntersect(query.sourceCaseIds, [candidate.revision.sourceCaseId])) {
    return false;
  }
  if (!valuesIntersect(query.sourceReleaseIds, [candidate.revision.sourceReleaseId])) {
    return false;
  }
  if (!valuesIntersect(query.executionClasses, executionClasses(candidate))) {
    return false;
  }
  if (candidate.objectType === "primitive") {
    const primitive = value as CapabilityPrimitive;
    if (
      query.primitiveMaturities?.length &&
      !query.primitiveMaturities.includes(primitive.maturity)
    ) return false;
    if (!valuesIntersect(query.functionIds, [primitive.primitiveId])) return false;
    const interfaces = [
      ...primitive.inputInterfacePatterns.map((item) => item.name),
      ...primitive.outputInterfacePatterns.map((item) => item.name),
    ];
    if (!valuesIntersect(query.interfaceIds, interfaces)) return false;
  } else if (candidate.objectType === "component_observation") {
    const observation = value as ComponentObservation;
    if (
      query.componentStates?.length &&
      !query.componentStates.includes(observation.state)
    ) return false;
    if (!valuesIntersect(query.functionIds, observation.functionIds)) return false;
    if (!valuesIntersect(query.interfaceIds, observation.interfaceIds)) return false;
  } else {
    const pattern = value as ArchitecturePattern;
    if (!valuesIntersect(query.functionIds, pattern.functionRoles)) return false;
    if (!valuesIntersect(query.interfaceIds, pattern.interfaceRoles)) return false;
  }
  return true;
}

function displayName(candidate: RevisionCandidate): string {
  const value = candidate.revision.value;
  if (candidate.objectType === "primitive") return (value as CapabilityPrimitive).name;
  if (candidate.objectType === "component_observation") {
    const identity = (value as ComponentObservation).componentIdentity;
    return [identity.manufacturer, identity.product, identity.exactModelOrVersion]
      .filter(Boolean)
      .join(" ");
  }
  return (value as ArchitecturePattern).name;
}

function toHit(
  candidate: RevisionCandidate,
  matchedFields: string[],
): CommonsCatalogSearchHit {
  const value = candidate.revision.value;
  const common = {
    objectType: candidate.objectType,
    catalogObjectId: candidate.entry.catalogObjectId,
    revisionId: candidate.revision.revisionId,
    revisionNumber: candidate.revision.revisionNumber,
    revisionState: candidate.revision.state,
    identityKey: candidate.entry.identityKey,
    displayName: displayName(candidate),
    matchedFields,
    sourceCaseId: candidate.revision.sourceCaseId,
    sourceReleaseId: candidate.revision.sourceReleaseId,
    sourceReleaseDigest: candidate.revision.sourceReleaseDigest,
    value,
  };
  if (candidate.objectType === "primitive") {
    const primitive = value as CapabilityPrimitive;
    return {
      ...common,
      maturityOrState: primitive.maturity,
      executionClass: (() => { const values = executionClasses(candidate).sort(); return values[values.length - 1]; })(),
      residuals: primitive.residuals,
      falsificationConditions: primitive.falsificationConditions,
    };
  }
  if (candidate.objectType === "component_observation") {
    const observation = value as ComponentObservation;
    return {
      ...common,
      maturityOrState: observation.state,
      executionClass: observation.executionClass,
      fixture: observation.fixture,
      environment: observation.environment,
      residuals: observation.residuals,
      falsificationConditions: [],
    };
  }
  const pattern = value as ArchitecturePattern;
  return {
    ...common,
    executionClass: (() => { const values = executionClasses(candidate).sort(); return values[values.length - 1]; })(),
    residuals: pattern.residuals,
    falsificationConditions: [],
  };
}

function candidates(catalog: CommonsCatalog): RevisionCandidate[] {
  const result: RevisionCandidate[] = [];
  const collect = <T extends CapabilityPrimitive | ComponentObservation | ArchitecturePattern>(
    objectType: CommonsCatalogObjectType,
    entries: CommonsCatalogEntry<T>[],
  ): void => {
    for (const entry of entries) {
      for (const revision of entry.revisions) {
        result.push({
          objectType,
          entry: entry as CommonsCatalogEntry<CapabilityPrimitive | ComponentObservation | ArchitecturePattern>,
          revision: revision as CommonsCatalogRevision<CapabilityPrimitive | ComponentObservation | ArchitecturePattern>,
        });
      }
    }
  };
  collect("primitive", catalog.primitiveEntries);
  collect("component_observation", catalog.componentObservationEntries);
  collect("architecture_pattern", catalog.architecturePatternEntries);
  return result;
}

export function searchCommonsCatalog(
  catalog: CommonsCatalog,
  query: CommonsCatalogSearchQuery,
): CommonsCatalogSearchResult {
  const includeSuperseded = query.includeSuperseded ?? false;
  const includeWithdrawn = query.includeWithdrawn ?? false;
  const hits = candidates(catalog)
    .filter((candidate) => {
      if (candidate.revision.state === "superseded" && !includeSuperseded) return false;
      if (candidate.revision.state === "withdrawn" && !includeWithdrawn) return false;
      return matchesFilters(candidate, query);
    })
    .flatMap((candidate) => {
      const matchedFields = textMatches(candidate, query.text);
      return matchedFields === null ? [] : [toHit(candidate, matchedFields)];
    })
    .sort((left, right) => {
      const stateRank = (state: string) =>
        state === "current" ? 0 : state === "superseded" ? 1 : 2;
      return (
        stateRank(left.revisionState) - stateRank(right.revisionState) ||
        left.objectType.localeCompare(right.objectType) ||
        left.catalogObjectId.localeCompare(right.catalogObjectId) ||
        right.revisionNumber - left.revisionNumber
      );
    });

  const limit = Math.max(1, Math.min(query.limit ?? 100, 500));
  return {
    catalogId: catalog.catalogId,
    catalogDigest: catalog.catalogDigest,
    query,
    totalMatches: hits.length,
    truncated: hits.length > limit,
    hits: hits.slice(0, limit),
  };
}
