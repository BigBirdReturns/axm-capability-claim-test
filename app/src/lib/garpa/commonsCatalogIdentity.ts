import type {
  ArchitecturePattern,
  CapabilityPrimitive,
  ComponentObservation,
} from "../../types/garpaCommons";
import type { CommonsCatalogObjectType } from "../../types/garpaCommonsCatalog";
import { canonicalStringify } from "./canonicalJson";

export type CommonsCatalogValue =
  | CapabilityPrimitive
  | ComponentObservation
  | ArchitecturePattern;

export function normalizeCommonsIdentity(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizedRecord(record: Record<string, string>): string {
  const normalized: Record<string, string> = {};
  for (const key of Object.keys(record).sort()) {
    normalized[normalizeCommonsIdentity(key)] = normalizeCommonsIdentity(record[key]);
  }
  return canonicalStringify(normalized);
}

export function commonsObjectId(
  objectType: CommonsCatalogObjectType,
  value: CommonsCatalogValue,
): string {
  if (objectType === "primitive") return (value as CapabilityPrimitive).primitiveId;
  if (objectType === "component_observation") {
    return (value as ComponentObservation).observationId;
  }
  return (value as ArchitecturePattern).patternId;
}

export function commonsIdentityKey(
  objectType: CommonsCatalogObjectType,
  value: CommonsCatalogValue,
): string {
  if (objectType === "primitive") {
    const primitive = value as CapabilityPrimitive;
    return [
      normalizeCommonsIdentity(primitive.name),
      normalizeCommonsIdentity(primitive.functionClass),
    ].join("|");
  }
  if (objectType === "component_observation") {
    const observation = value as ComponentObservation;
    const identity = observation.componentIdentity;
    return [
      normalizeCommonsIdentity(identity.manufacturer),
      normalizeCommonsIdentity(identity.product),
      normalizeCommonsIdentity(identity.exactModelOrVersion),
      normalizeCommonsIdentity(identity.firmwareOrSoftwareVersion),
      normalizeCommonsIdentity(observation.fixture),
      normalizedRecord(observation.environment),
      [...observation.metricResults.map((metric) => metric.metricId)].sort().join(","),
    ].join("|");
  }
  const pattern = value as ArchitecturePattern;
  return [
    normalizeCommonsIdentity(pattern.name),
    normalizeCommonsIdentity(pattern.problemShape),
  ].join("|");
}

export function commonsSourceCoordinates(
  objectType: CommonsCatalogObjectType,
  value: CommonsCatalogValue,
  fallback: {
    sourceCaseId: string;
    sourceReleaseId: string;
    sourceReleaseDigest: string;
  },
): {
  sourceCaseId: string;
  sourceReleaseId: string;
  sourceReleaseDigest: string;
} {
  if (objectType === "component_observation") {
    const observation = value as ComponentObservation;
    return {
      sourceCaseId: observation.sourceCaseId,
      sourceReleaseId: observation.sourceReleaseId,
      sourceReleaseDigest: observation.sourceReleaseDigest,
    };
  }
  return fallback;
}
