import type {
  CommonsSeededArchitectureFinding,
  CommonsSeededArchitectureRequest,
  CommonsSeededArchitectureResult,
} from "../../types/garpaCommonsSeededArchitecture";
import type { ComponentCandidate } from "../../types/garpaSubstitution";
import {
  computeCommonsSeededSubstitutionResultDigest,
  computeTargetSubstitutionPlanDigest,
} from "./commonsSeededArchitectureDigest";
import { runArchitectureGate } from "./runArchitectureGate";
import { runCommonsSeededSubstitutionGate } from "./runCommonsSeededSubstitutionGate";
import { validateCommonsSeededArchitectureRequest } from "./validateCommonsSeededArchitecture";

export const COMMONS_SEEDED_ARCHITECTURE_PROHIBITED_TRANSITIONS = [
  "A Commons-seeded architecture cannot omit or remap an admitted seeded component without rerunning component projection and seeded substitution.",
  "Architecture configuration must bind the exact target component version and any carried firmware or software version.",
  "Architecture admission does not transfer source qualification or authorize procurement, build execution, testing, deployment, mission equivalence, vendor parity, or publication.",
] as const;

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function exactSet(left: string[], right: string[]): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function addFinding(
  findings: CommonsSeededArchitectureFinding[],
  state: CommonsSeededArchitectureFinding["state"],
  reason: string,
  requiredAction: string,
  componentId?: string,
): void {
  findings.push({ state, componentId, reason, requiredAction });
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function expectedOptionIds(
  component: ComponentCandidate,
  selectedOptionIds: string[],
  plan: CommonsSeededArchitectureRequest["seededSubstitutionRequest"]["plan"],
): string[] {
  const selected = new Set(selectedOptionIds);
  return plan.options
    .filter(
      (option) =>
        selected.has(option.id) && option.componentIds.includes(component.id),
    )
    .map((option) => option.id);
}

export function runCommonsSeededArchitectureGate(
  input: CommonsSeededArchitectureRequest | unknown,
): CommonsSeededArchitectureResult {
  const validated = validateCommonsSeededArchitectureRequest(input);
  if (!validated.ok || !validated.value) {
    return {
      passed: false,
      state: "seeded_architecture_blocked",
      seededSubstitutionResult: {
        passed: false,
        state: "seeded_substitution_blocked",
        projectionResult: {
          passed: false,
          state: "projection_blocked",
          transferResult: {
            passed: false,
            state: "transfer_blocked",
            admittedNominationIds: [],
            candidateInputNominationIds: [],
            researchLeadNominationIds: [],
            blockedNominationIds: [],
            findings: [],
            nominations: [],
            pullList: validated.errors,
            prohibitedTransitions: [],
          },
          transferResultDigest: "",
          admittedProjectionIds: [],
          blockedProjectionIds: [],
          projectedComponents: [],
          findings: [],
          pullList: validated.errors,
          prohibitedTransitions: [],
        },
        projectionResultDigest: "",
        graphGate: {
          state: "goal_not_admitted",
          passed: false,
          requiredRequirementKeys: [],
          uncoveredRequirementKeys: [],
          unresolvedEssentialFunctionIds: [],
          orphanEssentialFunctionIds: [],
          danglingInterfaceIds: [],
          interfaceMismatchFindings: [],
          missingHumanRoleFunctionIds: [],
          incompleteConstraintSets: [],
          missingAuthorizationFunctionIds: [],
          vendorLeakageFunctionIds: [],
          pullList: validated.errors,
        },
        seededComponentIds: [],
        targetOnlyComponentIds: [],
        findings: [],
        planValidationErrors: validated.errors,
        pullList: validated.errors,
        prohibitedTransitions: [],
      },
      seededSubstitutionResultDigest: "",
      substitutionPlanDigest: "",
      seededComponentIds: [],
      selectedSeededComponentIds: [],
      findings: validated.errors.map((reason) => ({
        state: "architecture_validation_failed" as const,
        reason,
        requiredAction: "Repair the seeded architecture request and rerun validation.",
      })),
      architectureValidationErrors: validated.errors,
      pullList: validated.errors,
      prohibitedTransitions: [
        ...COMMONS_SEEDED_ARCHITECTURE_PROHIBITED_TRANSITIONS,
      ],
    };
  }

  const request = validated.value;
  const seededSubstitutionResult = runCommonsSeededSubstitutionGate(
    request.seededSubstitutionRequest,
  );
  const seededSubstitutionResultDigest =
    computeCommonsSeededSubstitutionResultDigest(seededSubstitutionResult);
  const substitutionPlanDigest = computeTargetSubstitutionPlanDigest(
    request.seededSubstitutionRequest.plan,
  );
  const findings: CommonsSeededArchitectureFinding[] = [];

  if (
    seededSubstitutionResultDigest !==
    request.expectedSeededSubstitutionResultDigest
  ) {
    addFinding(
      findings,
      "seeded_substitution_result_mismatch",
      "The expected seeded-substitution result digest does not match the recomputed result.",
      "Refresh the seeded-substitution result and bind the architecture to its canonical digest.",
    );
  }
  if (
    !seededSubstitutionResult.passed ||
    !seededSubstitutionResult.substitutionGate?.passed
  ) {
    addFinding(
      findings,
      "seeded_substitution_not_admitted",
      "The governing target substitution plan is not admitted for architecture.",
      "Resolve every seeded-substitution and existing substitution-gate finding before architecture selection.",
    );
  }
  if (
    request.architecture.caseId !==
    request.seededSubstitutionRequest.plan.caseId
  ) {
    addFinding(
      findings,
      "architecture_case_mismatch",
      "The candidate architecture belongs to a different case than the target substitution plan.",
      "Rebuild the architecture under the exact target case.",
    );
  }
  if (request.architecture.substitutionPlanDigest !== substitutionPlanDigest) {
    addFinding(
      findings,
      "substitution_plan_digest_mismatch",
      "The candidate architecture references a different substitution-plan digest.",
      "Recompute the canonical target plan digest and regenerate the architecture.",
    );
  }

  const seededComponentIds = seededSubstitutionResult.seededComponentIds;
  const selectedSeededComponentIds: string[] = [];
  for (const componentId of seededComponentIds) {
    const component = request.seededSubstitutionRequest.plan.components.find(
      (candidate) => candidate.id === componentId,
    );
    const selection = request.architecture.componentSelections.find(
      (candidate) => candidate.componentId === componentId,
    );
    if (!component || !selection) {
      addFinding(
        findings,
        "seeded_component_selection_missing",
        `Seeded component ${componentId} is absent from the candidate architecture.`,
        "Select the exact seeded component or rerun the upstream projection and substitution stages.",
        componentId,
      );
      continue;
    }
    selectedSeededComponentIds.push(componentId);
    const options = expectedOptionIds(
      component,
      request.architecture.selectedOptionIds,
      request.seededSubstitutionRequest.plan,
    );
    if (
      !exactSet(selection.functionIds, component.functionIds) ||
      !exactSet(selection.interfaceIds, component.interfaceIds) ||
      !exactSet(selection.optionIds, options)
    ) {
      addFinding(
        findings,
        "seeded_component_mapping_mismatch",
        `Architecture selection ${componentId} changes the admitted function, interface, or option mapping.`,
        "Use the exact target mappings from the seeded substitution plan.",
        componentId,
      );
    }
    const expectedFirmware =
      component.operatingRequirements.firmwareOrSoftwareVersion;
    if (
      normalize(selection.configuration.exactModelOrVersion) !==
        normalize(component.exactModelOrVersion) ||
      (expectedFirmware &&
        normalize(selection.configuration.firmwareOrSoftwareVersion) !==
          normalize(expectedFirmware))
    ) {
      addFinding(
        findings,
        "seeded_component_configuration_mismatch",
        `Architecture selection ${componentId} does not bind the exact target model and firmware or software version.`,
        "Record exactModelOrVersion and any required firmwareOrSoftwareVersion in the architecture configuration.",
        componentId,
      );
    }
  }

  if (findings.length > 0) {
    return {
      passed: false,
      state: "seeded_architecture_blocked",
      seededSubstitutionResult,
      seededSubstitutionResultDigest,
      substitutionPlanDigest,
      seededComponentIds,
      selectedSeededComponentIds,
      findings,
      architectureValidationErrors: [],
      architecture: request.architecture,
      pullList: dedupe(findings.map((finding) => finding.requiredAction)),
      prohibitedTransitions: [
        ...COMMONS_SEEDED_ARCHITECTURE_PROHIBITED_TRANSITIONS,
      ],
    };
  }

  const architectureGate = runArchitectureGate(
    request.architecture,
    request.seededSubstitutionRequest.projectionRequest.transferRequest
      .targetCapabilityGraph,
    request.seededSubstitutionRequest.plan,
    seededSubstitutionResult.substitutionGate!,
    substitutionPlanDigest,
  );
  const state = architectureGate.passed
    ? "seeded_architecture_admitted"
    : "seeded_architecture_incomplete";

  return {
    passed: architectureGate.passed,
    state,
    seededSubstitutionResult,
    seededSubstitutionResultDigest,
    substitutionPlanDigest,
    seededComponentIds,
    selectedSeededComponentIds,
    findings,
    architectureValidationErrors: [],
    architectureGate,
    architecture: request.architecture,
    pullList: architectureGate.pullList,
    prohibitedTransitions: [
      ...COMMONS_SEEDED_ARCHITECTURE_PROHIBITED_TRANSITIONS,
    ],
  };
}
