import type {
  ParityMetricObservation,
  VendorParityRequest,
} from "../../types/garpaParity";
import type {
  CommonsSeededVendorArtifactRef,
  CommonsSeededVendorParityEnvelope,
  CommonsSeededVendorParityResult,
} from "../../types/garpaCommonsSeededVendorParity";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

function sorted(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function canonicalParityObservations(
  observations: ParityMetricObservation[],
): ParityMetricObservation[] {
  return [...observations]
    .map((observation) => ({
      ...observation,
      evidenceArtifactIds: sorted(observation.evidenceArtifactIds),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function canonicalArtifacts(
  artifacts: CommonsSeededVendorArtifactRef[],
): CommonsSeededVendorArtifactRef[] {
  return [...artifacts]
    .map((artifact) => ({ ...artifact }))
    .sort((left, right) => left.artifactId.localeCompare(right.artifactId));
}

export function computeVendorParityRequestDigest(
  request: VendorParityRequest,
): string {
  return sha256Hex(
    canonicalStringify({
      ...request,
      requiredMetricIds: sorted(request.requiredMetricIds),
      essentialMetricIds: sorted(request.essentialMetricIds),
      comparators: [...request.comparators].sort((left, right) =>
        left.metricId.localeCompare(right.metricId),
      ),
      observations: canonicalParityObservations(request.observations),
      scenarioComparisons: [...request.scenarioComparisons].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      accountingBoundaries: [...request.accountingBoundaries].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    }),
  );
}

export function computeCommonsSeededGarpaObservationSetDigest(
  observations: ParityMetricObservation[],
): string {
  return sha256Hex(canonicalStringify(canonicalParityObservations(observations)));
}

export function computeCommonsSeededVendorObservationSetDigest(
  observations: ParityMetricObservation[],
): string {
  return sha256Hex(canonicalStringify(canonicalParityObservations(observations)));
}

export function computeCommonsSeededVendorParityEnvelopeDigest(
  envelope: CommonsSeededVendorParityEnvelope,
): string {
  const { envelopeDigest: _ignored, ...content } = envelope;
  return sha256Hex(
    canonicalStringify({
      ...content,
      vendorArtifacts: canonicalArtifacts(content.vendorArtifacts),
    }),
  );
}

export function computeCommonsSeededVendorParityResultDigest(
  result: CommonsSeededVendorParityResult,
): string {
  return sha256Hex(canonicalStringify(result));
}
