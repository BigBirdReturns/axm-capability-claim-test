import type { ArchitectureComponentSelection } from "../../types/garpaArchitecture";
import type {
  BuildManifestComponent,
  BuildManifestSubstitutionPolicy,
} from "../../types/garpaBuild";
import type {
  CommonsSeededBuildManifestBinding,
  CommonsSeededBuildManifestFinding,
  CommonsSeededBuildManifestRequest,
  CommonsSeededBuildManifestResult,
} from "../../types/garpaCommonsSeededBuildManifest";
import type { CommonsProjectedComponent } from "../../types/garpaCommonsProjection";
import type { ComponentCandidate, ComponentKind } from "../../types/garpaSubstitution";
import {
  computeArchitectureConfigurationDigest,
  computeBuildManifestComponentDigest,
  computeBuildManifestSubstitutionPolicyDigest,
  computeCommonsSeededQualificationResultDigest,
  computeTargetBuildManifestDigest,
  computeTargetQualificationContractDigest,
} from "./commonsSeededBuildManifestDigest";
import { computeArchitectureSelectionDigest } from "./commonsSeededQualificationDigest";
import { runBuildManifestGate } from "./runBuildManifestGate";
import { runCommonsSeededQualificationGate } from "./runCommonsSeededQualificationGate";
import { validateCommonsSeededBuildManifestRequest } from "./validateCommonsSeededBuildManifest";

export const COMMONS_SEEDED_BUILD_MANIFEST_PROHIBITED_TRANSITIONS = [
  "A build manifest cannot replace, remap, or mutate a Commons-seeded component without a new projection, substitution, architecture, and qualification chain.",
  "A frozen manifest is assembly intent, not an as-built receipt, execution authority, preflight receipt, test result, deployment authorization, vendor-parity result, or publication claim.",
  "Build-manifest admission cannot transfer source qualification, source calibration, source authorization, source performance, or mission equivalence into the target case.",
] as const;

function exactSet(left: string[], right: string[]): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function addFinding(
  findings: CommonsSeededBuildManifestFinding[],
  state: CommonsSeededBuildManifestFinding["state"],
  reason: string,
  requiredAction: string,
  binding?: CommonsSeededBuildManifestBinding,
): void {
  findings.push({
    state,
    bindingId: binding?.bindingId,
    componentId: binding?.componentId,
    reason,
    requiredAction,
  });
}

function expectedBuildKind(kind: ComponentKind): BuildManifestComponent["kind"] {
  switch (kind) {
    case "commercial_hardware":
    case "open_hardware":
      return "hardware";
    case "software_package":
    case "open_source_project":
    case "custom_code":
      return "software";
    case "service":
      return "service";
    case "custom_fabrication":
      return "fabricated_item";
    case "test_equipment":
      return "test_equipment";
    case "human_role":
    case "external_dependency":
      return "other";
  }
}

function requiredQualificationMetricIds(
  binding: CommonsSeededBuildManifestBinding,
  request: CommonsSeededBuildManifestRequest,
): string[] {
  const qualificationBinding =
    request.seededQualificationRequest.seededComponentBindings.find(
      (item) => item.bindingId === binding.qualificationBindingId,
    );
  if (!qualificationBinding) return [];

  const riskIds = new Set(qualificationBinding.riskIds);
  const residualIds = new Set(qualificationBinding.residualIds);
  const riskAndResidualMetrics =
    request.seededQualificationRequest.qualificationContract.metrics
      .filter(
        (metric) =>
          metric.riskIds.some((id) => riskIds.has(id)) ||
          metric.residualIds.some((id) => residualIds.has(id)),
      )
      .map((metric) => metric.id);
  return dedupe([
    ...qualificationBinding.requiredTestClosures.flatMap(
      (closure) => closure.metricIds,
    ),
    ...riskAndResidualMetrics,
  ]);
}

function bindingFindings(
  request: CommonsSeededBuildManifestRequest,
  binding: CommonsSeededBuildManifestBinding,
  projected: CommonsProjectedComponent | undefined,
  selection: ArchitectureComponentSelection | undefined,
  component: BuildManifestComponent | undefined,
  policy: BuildManifestSubstitutionPolicy | undefined,
): CommonsSeededBuildManifestFinding[] {
  const findings: CommonsSeededBuildManifestFinding[] = [];
  const qualificationBinding =
    request.seededQualificationRequest.seededComponentBindings.find(
      (item) => item.bindingId === binding.qualificationBindingId,
    );
  if (!projected || !selection || !component || !policy) {
    addFinding(
      findings,
      "seeded_component_binding_unexpected",
      "The build binding does not resolve to one seeded projected component, architecture selection, manifest component, and substitution policy.",
      "Bind only exact seeded components and include their manifest component and no-substitution policy.",
      binding,
    );
    return findings;
  }

  if (
    binding.sourceCatalogObjectId !== projected.source.catalogObjectId ||
    binding.sourceRevisionId !== projected.source.revisionId ||
    binding.sourceObjectDigest !== projected.source.objectDigest
  ) {
    addFinding(
      findings,
      "seeded_source_mismatch",
      "The build binding changes the Commons catalog object, revision, or object digest retained by component projection.",
      "Restore the exact source coordinates from the admitted projected component.",
      binding,
    );
  }

  if (
    !qualificationBinding ||
    qualificationBinding.componentId !== binding.componentId
  ) {
    addFinding(
      findings,
      "qualification_binding_mismatch",
      "The build binding does not resolve to the seeded component's frozen qualification binding.",
      "Reference the exact qualification binding that closed this seeded component.",
      binding,
    );
  } else if (
    qualificationBinding.sourceCatalogObjectId !== binding.sourceCatalogObjectId ||
    qualificationBinding.sourceRevisionId !== binding.sourceRevisionId ||
    qualificationBinding.sourceObjectDigest !== binding.sourceObjectDigest
  ) {
    addFinding(
      findings,
      "qualification_binding_mismatch",
      "The build binding source coordinates differ from the frozen qualification binding.",
      "Carry the exact qualified source coordinates into build-manifest custody.",
      binding,
    );
  }

  const architectureSelectionDigest = computeArchitectureSelectionDigest(selection);
  if (
    binding.architectureSelectionDigest !== architectureSelectionDigest ||
    qualificationBinding?.architectureSelectionDigest !==
      architectureSelectionDigest
  ) {
    addFinding(
      findings,
      "architecture_selection_digest_mismatch",
      "The build binding does not match the exact qualified architecture component selection.",
      "Restore the admitted architecture selection and recompute its digest.",
      binding,
    );
  }

  const architectureConfigurationDigest =
    computeArchitectureConfigurationDigest(selection);
  if (
    binding.architectureConfigurationDigest !== architectureConfigurationDigest
  ) {
    addFinding(
      findings,
      "architecture_configuration_digest_mismatch",
      "The build binding does not match the architecture component configuration.",
      "Bind the canonical digest of the admitted architecture configuration.",
      binding,
    );
  }
  if (component.configurationDigest !== architectureConfigurationDigest) {
    addFinding(
      findings,
      "seeded_component_configuration_mismatch",
      "The manifest component configuration digest does not bind the admitted architecture configuration.",
      "Set configurationDigest to the canonical architecture-configuration digest.",
      binding,
    );
  }

  if (
    binding.buildComponentDigest !== computeBuildManifestComponentDigest(component)
  ) {
    addFinding(
      findings,
      "build_component_digest_mismatch",
      "The binding does not match the exact manifest component record.",
      "Restore the manifest component and recompute the build-component digest.",
      binding,
    );
  }

  const candidate: ComponentCandidate = projected.candidate;
  if (
    component.componentId !== candidate.id ||
    component.kind !== expectedBuildKind(candidate.kind) ||
    component.exactModelOrVersion !== candidate.exactModelOrVersion ||
    component.quantity !== selection.quantity ||
    component.license !== candidate.license ||
    component.unitCost !== candidate.price?.amount ||
    component.currency !== candidate.price?.currency
  ) {
    addFinding(
      findings,
      "seeded_component_identity_mismatch",
      "The manifest changes the seeded component identity, kind, quantity, license, or target-case price boundary.",
      "Carry the exact projected candidate, selected quantity, license, and target price into the manifest.",
      binding,
    );
  }

  const expectedFirmware =
    selection.configuration.firmwareOrSoftwareVersion ??
    candidate.operatingRequirements.firmwareOrSoftwareVersion;
  if (
    expectedFirmware &&
    component.firmwareOrRuntimeVersion !== expectedFirmware
  ) {
    addFinding(
      findings,
      "seeded_component_configuration_mismatch",
      "The manifest changes or omits the qualified seeded firmware or software version.",
      "Carry the exact architecture firmwareOrSoftwareVersion into firmwareOrRuntimeVersion.",
      binding,
    );
  }
  if (
    !exactSet(component.functionIds, selection.functionIds) ||
    !exactSet(component.interfaceIds, selection.interfaceIds) ||
    !exactSet(component.functionIds, candidate.functionIds) ||
    !exactSet(component.interfaceIds, candidate.interfaceIds)
  ) {
    addFinding(
      findings,
      "seeded_component_mapping_mismatch",
      "The manifest changes the seeded component's target function or interface mapping.",
      "Restore the exact target mappings admitted by projection and architecture selection.",
      binding,
    );
  }

  if (
    binding.substitutionPolicyDigest !==
    computeBuildManifestSubstitutionPolicyDigest(policy)
  ) {
    addFinding(
      findings,
      "seeded_substitution_policy_mismatch",
      "The binding does not match the manifest substitution policy.",
      "Restore the exact policy and recompute its canonical digest.",
      binding,
    );
  }
  const requiredMetricIds = requiredQualificationMetricIds(binding, request);
  if (
    policy.policy !== "no_substitution" ||
    !exactSet(policy.requiredRegressionTestIds, requiredMetricIds) ||
    policy.prohibitedSubstitutions.length === 0
  ) {
    addFinding(
      findings,
      "seeded_substitution_policy_mismatch",
      "The seeded component is not locked against replacement or its policy drops qualification regression tests.",
      "Use no_substitution, retain every qualification metric as a required regression test, and name prohibited replacements.",
      binding,
    );
  }

  const actualCalibrationItemIds = request.buildManifest.calibrationPlan
    .filter((item) => item.subjectId === binding.componentId)
    .map((item) => item.id);
  if (
    !exactSet(binding.requiredCalibrationItemIds, actualCalibrationItemIds) ||
    actualCalibrationItemIds.length === 0
  ) {
    addFinding(
      findings,
      "seeded_calibration_custody_mismatch",
      "The build binding does not carry the exact seeded-component calibration or preassembly verification plan.",
      "Bind every calibration or verification item for the seeded component and retain at least one before controlled assembly.",
      binding,
    );
  }

  const actualAssemblyStepIds = request.buildManifest.assemblySteps
    .filter((step) => step.componentIds.includes(binding.componentId))
    .map((step) => step.id);
  if (!exactSet(binding.requiredAssemblyStepIds, actualAssemblyStepIds)) {
    addFinding(
      findings,
      "seeded_assembly_custody_mismatch",
      "The build binding does not carry every assembly step that inventories, installs, configures, or verifies the seeded component.",
      "Bind the exact assembly-step set containing the seeded component.",
      binding,
    );
  }

  return findings;
}

export function runCommonsSeededBuildManifestGate(
  input: CommonsSeededBuildManifestRequest | unknown,
): CommonsSeededBuildManifestResult {
  const validated = validateCommonsSeededBuildManifestRequest(input);
  if (!validated.ok || !validated.value) {
    return {
      passed: false,
      state: "seeded_build_manifest_blocked",
      seededQualificationResultDigest: "",
      candidateArchitectureDigest: "",
      qualificationContractDigest: "",
      buildManifestDigest: "",
      seededComponentIds: [],
      boundSeededComponentIds: [],
      findings: validated.errors.map((reason) => ({
        state: "build_manifest_validation_failed" as const,
        reason,
        requiredAction:
          "Repair the seeded build-manifest request and rerun validation.",
      })),
      buildManifestValidationErrors: validated.errors,
      pullList: validated.errors,
      prohibitedTransitions: [
        ...COMMONS_SEEDED_BUILD_MANIFEST_PROHIBITED_TRANSITIONS,
      ],
    };
  }

  const request = validated.value;
  const seededQualificationResult = runCommonsSeededQualificationGate(
    request.seededQualificationRequest,
  );
  const seededQualificationResultDigest =
    computeCommonsSeededQualificationResultDigest(seededQualificationResult);
  const architecture = request.seededQualificationRequest
    .seededArchitectureRequest.architecture;
  const plan = request.seededQualificationRequest.seededArchitectureRequest
    .seededSubstitutionRequest.plan;
  const qualification = request.seededQualificationRequest.qualificationContract;
  const candidateArchitectureDigest =
    seededQualificationResult.candidateArchitectureDigest;
  const qualificationContractDigest =
    computeTargetQualificationContractDigest(qualification);
  const buildManifestDigest = computeTargetBuildManifestDigest(
    request.buildManifest,
  );
  const findings: CommonsSeededBuildManifestFinding[] = [];

  if (
    seededQualificationResultDigest !==
    request.expectedSeededQualificationResultDigest
  ) {
    addFinding(
      findings,
      "seeded_qualification_result_mismatch",
      "The expected seeded-qualification result digest does not match deterministic recomputation.",
      "Refresh the seeded-qualification result and bind the build request to its canonical digest.",
    );
  }
  if (
    !seededQualificationResult.passed ||
    !seededQualificationResult.qualificationGate?.passed
  ) {
    addFinding(
      findings,
      "seeded_qualification_not_admitted",
      "The governing Commons-seeded qualification contract is not admitted for build-manifest preparation.",
      "Resolve every seeded qualification and existing qualification-gate finding first.",
    );
  }
  if (request.buildManifest.caseId !== architecture.caseId) {
    addFinding(
      findings,
      "build_manifest_case_mismatch",
      "The build manifest belongs to a different target case.",
      "Prepare the manifest under the exact qualified target case.",
    );
  }
  if (
    request.buildManifest.candidateArchitectureDigest !==
    candidateArchitectureDigest
  ) {
    addFinding(
      findings,
      "candidate_architecture_digest_mismatch",
      "The manifest references a different candidate architecture.",
      "Bind the manifest to the canonical qualified architecture digest.",
    );
  }
  if (
    request.buildManifest.qualificationContractDigest !==
    qualificationContractDigest
  ) {
    addFinding(
      findings,
      "qualification_contract_digest_mismatch",
      "The manifest references a different qualification contract.",
      "Bind the manifest to the canonical frozen qualification-contract digest.",
    );
  }
  if (request.buildManifest.manifestDigest !== buildManifestDigest) {
    addFinding(
      findings,
      "build_manifest_digest_mismatch",
      "The manifestDigest does not match the canonical manifest content.",
      "Recompute manifestDigest after restoring the exact frozen manifest.",
    );
  }
  if (
    request.frozenAt !== request.buildManifest.frozenAt ||
    Date.parse(request.frozenAt) < Date.parse(qualification.frozenAt)
  ) {
    addFinding(
      findings,
      "build_manifest_freeze_time_mismatch",
      "The build freeze time differs from the manifest or predates the frozen qualification contract.",
      "Use the manifest frozenAt value and freeze only after qualification admission.",
    );
  }

  const projected = seededQualificationResult.seededArchitectureResult
    ?.seededSubstitutionResult.projectionResult.projectedComponents ?? [];
  const seededComponentIds = projected.map((item) => item.candidate.id);
  const bindingsByComponent = new Map(
    request.seededComponentBindings.map((binding) => [
      binding.componentId,
      binding,
    ]),
  );
  for (const componentId of seededComponentIds) {
    if (!bindingsByComponent.has(componentId)) {
      addFinding(
        findings,
        "seeded_component_binding_missing",
        `Seeded component ${componentId} has no build-manifest binding.`,
        "Add one exact build-manifest binding for every seeded component.",
      );
    }
  }

  for (const binding of request.seededComponentBindings) {
    const item = projected.find(
      (candidate) => candidate.candidate.id === binding.componentId,
    );
    const selection = architecture.componentSelections.find(
      (candidate) => candidate.componentId === binding.componentId,
    );
    const component = request.buildManifest.components.find(
      (candidate) => candidate.componentId === binding.componentId,
    );
    const policy = request.buildManifest.substitutionPolicies.find(
      (candidate) => candidate.componentId === binding.componentId,
    );
    findings.push(
      ...bindingFindings(
        request,
        binding,
        item,
        selection,
        component,
        policy,
      ),
    );
  }

  const boundSeededComponentIds = request.seededComponentBindings
    .map((binding) => binding.componentId)
    .filter((componentId) => seededComponentIds.includes(componentId));
  if (findings.length > 0) {
    return {
      passed: false,
      state: "seeded_build_manifest_blocked",
      seededQualificationResult,
      seededQualificationResultDigest,
      candidateArchitectureDigest,
      qualificationContractDigest,
      buildManifestDigest,
      seededComponentIds,
      boundSeededComponentIds,
      findings,
      buildManifestValidationErrors: [],
      buildManifest: request.buildManifest,
      pullList: dedupe(findings.map((finding) => finding.requiredAction)),
      prohibitedTransitions: [
        ...COMMONS_SEEDED_BUILD_MANIFEST_PROHIBITED_TRANSITIONS,
      ],
    };
  }

  const buildManifestGate = runBuildManifestGate(
    request.buildManifest,
    architecture,
    plan,
    qualification,
    seededQualificationResult.qualificationGate!,
    qualificationContractDigest,
  );
  const state = buildManifestGate.passed
    ? "seeded_build_manifest_admitted"
    : "seeded_build_manifest_incomplete";

  return {
    passed: buildManifestGate.passed,
    state,
    seededQualificationResult,
    seededQualificationResultDigest,
    candidateArchitectureDigest,
    qualificationContractDigest,
    buildManifestDigest,
    seededComponentIds,
    boundSeededComponentIds,
    findings,
    buildManifestValidationErrors: [],
    buildManifestGate,
    buildManifest: request.buildManifest,
    pullList: buildManifestGate.pullList,
    prohibitedTransitions: [
      ...COMMONS_SEEDED_BUILD_MANIFEST_PROHIBITED_TRANSITIONS,
    ],
  };
}
