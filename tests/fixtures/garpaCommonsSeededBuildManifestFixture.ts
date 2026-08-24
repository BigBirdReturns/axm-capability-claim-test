import manifestRaw from "../../examples/garpa-commons-seeded-build-manifest/build-manifest.json";
import type { BuildManifest } from "../../app/src/types/garpaBuild";
import type { CommonsSeededBuildManifestRequest } from "../../app/src/types/garpaCommonsSeededBuildManifest";
import {
  computeArchitectureConfigurationDigest,
  computeBuildManifestComponentDigest,
  computeBuildManifestSubstitutionPolicyDigest,
  computeCommonsSeededQualificationResultDigest,
  computeTargetBuildManifestDigest,
  computeTargetQualificationContractDigest,
} from "../../app/src/lib/garpa/commonsSeededBuildManifestDigest";
import { runCommonsSeededQualificationGate } from "../../app/src/lib/garpa/runCommonsSeededQualificationGate";
import { buildSeededQualificationRequest } from "./garpaCommonsSeededQualificationFixture";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function requireState(condition: unknown, detail: unknown): asserts condition {
  if (!condition) {
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
}

export function buildSeededBuildManifestRequest(): CommonsSeededBuildManifestRequest {
  const qualificationRequest = buildSeededQualificationRequest();
  const qualificationResult = runCommonsSeededQualificationGate(
    qualificationRequest,
  );
  requireState(qualificationResult.passed, qualificationResult);

  const manifest = clone(manifestRaw) as unknown as BuildManifest;
  const architecture =
    qualificationRequest.seededArchitectureRequest.architecture;
  requireState(
    manifest.candidateArchitectureDigest ===
      qualificationResult.candidateArchitectureDigest,
    {
      expected: qualificationResult.candidateArchitectureDigest,
      actual: manifest.candidateArchitectureDigest,
    },
  );
  const qualificationContractDigest =
    computeTargetQualificationContractDigest(
      qualificationRequest.qualificationContract,
    );
  requireState(
    manifest.qualificationContractDigest === qualificationContractDigest,
    {
      expected: qualificationContractDigest,
      actual: manifest.qualificationContractDigest,
    },
  );
  for (const component of manifest.components) {
    const selection = architecture.componentSelections.find(
      (item) => item.componentId === component.componentId,
    );
    requireState(
      selection,
      `Missing architecture selection ${component.componentId}`,
    );
    const expectedConfigurationDigest =
      computeArchitectureConfigurationDigest(selection);
    requireState(
      component.configurationDigest === expectedConfigurationDigest,
      {
        componentId: component.componentId,
        expected: expectedConfigurationDigest,
        actual: component.configurationDigest,
      },
    );
  }
  const expectedManifestDigest = computeTargetBuildManifestDigest(manifest);
  requireState(manifest.manifestDigest === expectedManifestDigest, {
    expected: expectedManifestDigest,
    actual: manifest.manifestDigest,
  });

  const projected = qualificationResult.seededArchitectureResult
    ?.seededSubstitutionResult.projectionResult.projectedComponents[0];
  requireState(projected, qualificationResult);
  const qualificationBinding = qualificationRequest.seededComponentBindings.find(
    (item) => item.componentId === projected.candidate.id,
  );
  const selection = architecture.componentSelections.find(
    (item) => item.componentId === projected.candidate.id,
  );
  const component = manifest.components.find(
    (item) => item.componentId === projected.candidate.id,
  );
  const policy = manifest.substitutionPolicies.find(
    (item) => item.componentId === projected.candidate.id,
  );
  requireState(qualificationBinding && selection && component && policy, {
    qualificationBinding,
    selection,
    component,
    policy,
  });

  return {
    schemaVersion: 1,
    seededQualificationRequest: qualificationRequest,
    expectedSeededQualificationResultDigest:
      computeCommonsSeededQualificationResultDigest(qualificationResult),
    buildManifest: manifest,
    seededComponentBindings: [
      {
        bindingId: "binding-sensor-v1-target-build-manifest",
        componentId: projected.candidate.id,
        sourceCatalogObjectId: projected.source.catalogObjectId,
        sourceRevisionId: projected.source.revisionId,
        sourceObjectDigest: projected.source.objectDigest,
        qualificationBindingId: qualificationBinding.bindingId,
        architectureSelectionDigest:
          qualificationBinding.architectureSelectionDigest,
        architectureConfigurationDigest:
          computeArchitectureConfigurationDigest(selection),
        buildComponentDigest: computeBuildManifestComponentDigest(component),
        substitutionPolicyDigest:
          computeBuildManifestSubstitutionPolicyDigest(policy),
        requiredCalibrationItemIds: manifest.calibrationPlan
          .filter((item) => item.subjectId === projected.candidate.id)
          .map((item) => item.id),
        requiredAssemblyStepIds: manifest.assemblySteps
          .filter((step) => step.componentIds.includes(projected.candidate.id))
          .map((step) => step.id),
      },
    ],
    frozenAt: manifest.frozenAt,
  };
}
