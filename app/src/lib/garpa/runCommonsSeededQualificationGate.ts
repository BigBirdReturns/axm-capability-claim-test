import type { ArchitectureResidual, ArchitectureRisk } from "../../types/garpaArchitecture";
import type {
  CommonsSeededQualificationBinding,
  CommonsSeededQualificationFinding,
  CommonsSeededQualificationRequest,
  CommonsSeededQualificationResult,
  CommonsSeededQualificationTestClosure,
} from "../../types/garpaCommonsSeededQualification";
import type { CommonsProjectedComponent } from "../../types/garpaCommonsProjection";
import {
  computeArchitectureSelectionDigest,
  computeCommonsSeededArchitectureResultDigest,
  computeTargetCandidateArchitectureDigest,
  computeTargetMissionOutcomeDigest,
} from "./commonsSeededQualificationDigest";
import { runCommonsSeededArchitectureGate } from "./runCommonsSeededArchitectureGate";
import { runQualificationGate } from "./runQualificationGate";
import { validateCommonsSeededQualificationRequest } from "./validateCommonsSeededQualification";

export const COMMONS_SEEDED_QUALIFICATION_PROHIBITED_TRANSITIONS = [
  "A qualification contract cannot transfer a source-case test result, pass state, calibration state, authorization, or mission-equivalence claim into the target case.",
  "Every source requalification requirement must close through a target scenario and target metric with target instrumentation and receipt custody.",
  "Qualification admission does not authorize procurement, assembly, physical execution, deployment, vendor parity, or publication.",
] as const;

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function exactSet(left: string[], right: string[]): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function addFinding(
  findings: CommonsSeededQualificationFinding[],
  state: CommonsSeededQualificationFinding["state"],
  reason: string,
  requiredAction: string,
  binding?: CommonsSeededQualificationBinding,
): void {
  findings.push({
    state,
    bindingId: binding?.bindingId,
    componentId: binding?.componentId,
    reason,
    requiredAction,
  });
}

function scenarioAndMetricReferencesValid(
  closure: CommonsSeededQualificationTestClosure,
  request: CommonsSeededQualificationRequest,
): boolean {
  const scenarioById = new Map(
    request.qualificationContract.scenarios.map((scenario) => [scenario.id, scenario]),
  );
  const metricIds = new Set(
    request.qualificationContract.metrics.map((metric) => metric.id),
  );
  return (
    closure.scenarioIds.every((id) => scenarioById.has(id)) &&
    closure.metricIds.every((id) => metricIds.has(id)) &&
    closure.scenarioIds.every((scenarioId) => {
      const scenario = scenarioById.get(scenarioId)!;
      return closure.metricIds.every((metricId) =>
        scenario.metricIds.includes(metricId),
      );
    })
  );
}

function scenarioExercisesTargetEnvironment(
  closure: CommonsSeededQualificationTestClosure,
  request: CommonsSeededQualificationRequest,
): boolean {
  const scenarioById = new Map(
    request.qualificationContract.scenarios.map((scenario) => [scenario.id, scenario]),
  );
  const target = request.seededArchitectureRequest.seededSubstitutionRequest
    .projectionRequest.transferRequest.targetEnvironment;
  return closure.scenarioIds.some((scenarioId) => {
    const scenario = scenarioById.get(scenarioId);
    if (!scenario) return false;
    return Object.entries(target).every(
      ([key, value]) => normalize(scenario.environment[key]) === normalize(value),
    );
  });
}

function risksForComponent(
  componentId: string,
  request: CommonsSeededQualificationRequest,
): ArchitectureRisk[] {
  return request.seededArchitectureRequest.architecture.risks.filter((risk) =>
    risk.affectedComponentIds.includes(componentId),
  );
}

function residualsForComponent(
  componentId: string,
  request: CommonsSeededQualificationRequest,
): ArchitectureResidual[] {
  return request.seededArchitectureRequest.architecture.residuals.filter(
    (residual) => residual.sourceComponentIds.includes(componentId),
  );
}

function bindingFindings(
  request: CommonsSeededQualificationRequest,
  binding: CommonsSeededQualificationBinding,
  projected: CommonsProjectedComponent | undefined,
): CommonsSeededQualificationFinding[] {
  const findings: CommonsSeededQualificationFinding[] = [];
  const architecture = request.seededArchitectureRequest.architecture;
  const selection = architecture.componentSelections.find(
    (item) => item.componentId === binding.componentId,
  );
  if (!projected || !selection) {
    addFinding(
      findings,
      "seeded_component_binding_unexpected",
      "The binding does not resolve to a seeded projected component and architecture selection.",
      "Bind only exact seeded components admitted by the governing architecture result.",
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
      "The qualification binding changes the source Commons object, revision, or object digest.",
      "Use the exact source coordinates retained by component projection.",
      binding,
    );
  }
  if (
    binding.architectureSelectionDigest !==
    computeArchitectureSelectionDigest(selection)
  ) {
    addFinding(
      findings,
      "seeded_selection_digest_mismatch",
      "The qualification binding does not match the exact architecture component selection.",
      "Recompute the architecture-selection digest after restoring the admitted selection.",
      binding,
    );
  }

  const risks = risksForComponent(binding.componentId, request);
  const residuals = residualsForComponent(binding.componentId, request);
  if (!exactSet(binding.riskIds, risks.map((risk) => risk.id))) {
    addFinding(
      findings,
      "seeded_risk_coverage_mismatch",
      "The binding does not carry every architecture risk affecting the seeded component.",
      "Bind the exact architecture risk set before freezing qualification.",
      binding,
    );
  }
  if (!exactSet(binding.residualIds, residuals.map((residual) => residual.id))) {
    addFinding(
      findings,
      "seeded_residual_coverage_mismatch",
      "The binding does not carry every architecture residual affecting the seeded component.",
      "Bind the exact architecture residual set before freezing qualification.",
      binding,
    );
  }

  for (const requirement of projected.requiredQualificationTests) {
    const closure = binding.requiredTestClosures.find(
      (candidate) => candidate.requirement === requirement,
    );
    if (!closure) {
      addFinding(
        findings,
        "required_requalification_test_missing",
        `Source-bound requalification requirement is missing: ${requirement}`,
        "Map the exact requirement to target scenarios and metrics.",
        binding,
      );
      continue;
    }
    if (!scenarioAndMetricReferencesValid(closure, request)) {
      addFinding(
        findings,
        "requalification_test_reference_invalid",
        `Requalification closure for ${requirement} does not resolve to scenarios that exercise every named metric.`,
        "Reference existing target scenarios and metrics and include every metric in each named scenario.",
        binding,
      );
    }
    if (!scenarioExercisesTargetEnvironment(closure, request)) {
      addFinding(
        findings,
        "target_environment_not_exercised",
        `Requalification closure for ${requirement} does not exercise the exact structured target environment.`,
        "Add a target scenario whose environment contains every admitted target environment dimension and value.",
        binding,
      );
    }
  }

  const metrics = request.qualificationContract.metrics;
  for (const risk of risks.filter((item) => item.closureState === "requires_test")) {
    if (!metrics.some((metric) => metric.riskIds.includes(risk.id))) {
      addFinding(
        findings,
        "seeded_risk_coverage_mismatch",
        `Required seeded-component risk ${risk.id} has no target qualification metric.`,
        "Add a target qualification metric that names the exact risk.",
        binding,
      );
    }
  }
  for (const residual of residuals.filter((item) => item.disposition === "qualify")) {
    if (!metrics.some((metric) => metric.residualIds.includes(residual.id))) {
      addFinding(
        findings,
        "seeded_residual_coverage_mismatch",
        `Qualify-disposition seeded residual ${residual.id} has no target qualification metric.`,
        "Add a target qualification metric that names the exact residual.",
        binding,
      );
    }
  }
  return findings;
}

export function runCommonsSeededQualificationGate(
  input: CommonsSeededQualificationRequest | unknown,
): CommonsSeededQualificationResult {
  const validated = validateCommonsSeededQualificationRequest(input);
  if (!validated.ok || !validated.value) {
    return {
      passed: false,
      state: "seeded_qualification_blocked",
      seededArchitectureResultDigest: "",
      missionOutcomeDigest: "",
      candidateArchitectureDigest: "",
      seededComponentIds: [],
      boundSeededComponentIds: [],
      findings: validated.errors.map((reason) => ({
        state: "qualification_validation_failed" as const,
        reason,
        requiredAction: "Repair the seeded qualification request and rerun validation.",
      })),
      qualificationValidationErrors: validated.errors,
      pullList: validated.errors,
      prohibitedTransitions: [
        ...COMMONS_SEEDED_QUALIFICATION_PROHIBITED_TRANSITIONS,
      ],
    };
  }

  const request = validated.value;
  const seededArchitectureResult = runCommonsSeededArchitectureGate(
    request.seededArchitectureRequest,
  );
  const seededArchitectureResultDigest =
    computeCommonsSeededArchitectureResultDigest(seededArchitectureResult);
  const missionOutcomeDigest = computeTargetMissionOutcomeDigest(
    request.targetMissionOutcome,
  );
  const candidateArchitectureDigest = computeTargetCandidateArchitectureDigest(
    request.seededArchitectureRequest.architecture,
  );
  const findings: CommonsSeededQualificationFinding[] = [];

  if (
    seededArchitectureResultDigest !==
    request.expectedSeededArchitectureResultDigest
  ) {
    addFinding(
      findings,
      "seeded_architecture_result_mismatch",
      "The expected seeded-architecture result digest does not match the recomputed result.",
      "Refresh the seeded-architecture result and bind qualification to its canonical digest.",
    );
  }
  if (
    !seededArchitectureResult.passed ||
    !seededArchitectureResult.architectureGate?.passed
  ) {
    addFinding(
      findings,
      "seeded_architecture_not_admitted",
      "The governing seeded architecture is not admitted for qualification.",
      "Resolve every seed-custody and existing architecture-gate finding before freezing qualification.",
    );
  }
  if (
    request.targetMissionOutcomeDigest !== missionOutcomeDigest ||
    request.seededArchitectureRequest.architecture.missionOutcomeDigest !==
      missionOutcomeDigest ||
    request.qualificationContract.missionOutcomeDigest !== missionOutcomeDigest
  ) {
    addFinding(
      findings,
      "mission_outcome_digest_mismatch",
      "The target mission outcome, architecture, and qualification contract are not bound to one canonical digest.",
      "Recompute the canonical mission-outcome digest and regenerate the graph, architecture, and contract chain.",
    );
  }
  if (
    request.qualificationContract.caseId !==
    request.seededArchitectureRequest.architecture.caseId
  ) {
    addFinding(
      findings,
      "qualification_case_mismatch",
      "The qualification contract belongs to a different target case.",
      "Freeze qualification under the exact target architecture case.",
    );
  }
  if (
    request.qualificationContract.candidateArchitectureDigest !==
    candidateArchitectureDigest
  ) {
    addFinding(
      findings,
      "architecture_digest_mismatch",
      "The qualification contract references a different candidate-architecture digest.",
      "Recompute the canonical target architecture digest and regenerate the contract.",
    );
  }

  const projected = seededArchitectureResult.seededSubstitutionResult
    .projectionResult.projectedComponents;
  const seededComponentIds = projected.map((item) => item.candidate.id);
  const bindingByComponent = new Map(
    request.seededComponentBindings.map((binding) => [binding.componentId, binding]),
  );
  for (const componentId of seededComponentIds) {
    if (!bindingByComponent.has(componentId)) {
      addFinding(
        findings,
        "seeded_component_binding_missing",
        `Seeded component ${componentId} has no qualification binding.`,
        "Add one source-bound qualification binding for every seeded component.",
      );
    }
  }
  for (const binding of request.seededComponentBindings) {
    const item = projected.find(
      (candidate) => candidate.candidate.id === binding.componentId,
    );
    findings.push(...bindingFindings(request, binding, item));
  }

  const boundSeededComponentIds = request.seededComponentBindings
    .map((binding) => binding.componentId)
    .filter((componentId) => seededComponentIds.includes(componentId));
  if (findings.length > 0) {
    return {
      passed: false,
      state: "seeded_qualification_blocked",
      seededArchitectureResult,
      seededArchitectureResultDigest,
      missionOutcomeDigest,
      candidateArchitectureDigest,
      seededComponentIds,
      boundSeededComponentIds,
      findings,
      qualificationValidationErrors: [],
      qualificationContract: request.qualificationContract,
      pullList: dedupe(findings.map((finding) => finding.requiredAction)),
      prohibitedTransitions: [
        ...COMMONS_SEEDED_QUALIFICATION_PROHIBITED_TRANSITIONS,
      ],
    };
  }

  const qualificationGate = runQualificationGate(
    request.qualificationContract,
    request.targetMissionOutcome,
    request.seededArchitectureRequest.architecture,
    seededArchitectureResult.architectureGate!,
    candidateArchitectureDigest,
  );
  const state = qualificationGate.passed
    ? "seeded_qualification_admitted"
    : "seeded_qualification_incomplete";

  return {
    passed: qualificationGate.passed,
    state,
    seededArchitectureResult,
    seededArchitectureResultDigest,
    missionOutcomeDigest,
    candidateArchitectureDigest,
    seededComponentIds,
    boundSeededComponentIds,
    findings,
    qualificationValidationErrors: [],
    qualificationGate,
    qualificationContract: request.qualificationContract,
    pullList: qualificationGate.pullList,
    prohibitedTransitions: [
      ...COMMONS_SEEDED_QUALIFICATION_PROHIBITED_TRANSITIONS,
    ],
  };
}
