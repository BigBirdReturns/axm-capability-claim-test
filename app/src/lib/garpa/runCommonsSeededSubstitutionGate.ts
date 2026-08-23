import type { CapabilityGraphGateResult } from "../../types/garpaCapability";
import type {
  CommonsSeededSubstitutionFinding,
  CommonsSeededSubstitutionRequest,
  CommonsSeededSubstitutionResult,
} from "../../types/garpaCommonsSeededSubstitution";
import { canonicalStringify } from "./canonicalJson";
import { computeCommonsProjectionResultDigest } from "./commonsSeededSubstitutionDigest";
import { runCommonsComponentProjectionGate } from "./runCommonsComponentProjectionGate";
import { runSubstitutionGate } from "./runSubstitutionGate";
import { validateCommonsSeededSubstitutionRequest } from "./validateCommonsSeededSubstitution";

export const COMMONS_SEEDED_SUBSTITUTION_PROHIBITED_TRANSITIONS = [
  "A seeded substitution plan cannot replace, omit, or mutate an admitted projected component without rerunning Commons component projection.",
  "Target-only components, options, compatibility edges, availability, price, licensing, and cost boundaries must be supported by the target claim packet.",
  "An incomplete seeded plan cannot become a candidate architecture, qualification contract, procurement decision, test authority, deployment authority, mission-equivalence claim, vendor-parity claim, or publication claim.",
] as const;

function graphGateFromReceipt(
  request: CommonsSeededSubstitutionRequest,
): CapabilityGraphGateResult {
  const receipt = request.projectionRequest.transferRequest.targetGraphAdmissionReceipt;
  return {
    state: receipt.state,
    passed: receipt.passed,
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
    pullList: [],
  };
}

function addFinding(
  findings: CommonsSeededSubstitutionFinding[],
  state: CommonsSeededSubstitutionFinding["state"],
  reason: string,
  requiredAction: string,
  componentId?: string,
): void {
  findings.push({ state, componentId, reason, requiredAction });
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function runCommonsSeededSubstitutionGate(
  input: CommonsSeededSubstitutionRequest | unknown,
): CommonsSeededSubstitutionResult {
  const validated = validateCommonsSeededSubstitutionRequest(input);
  if (!validated.ok || !validated.value) {
    const graphGate: CapabilityGraphGateResult = {
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
    };
    return {
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
      graphGate,
      seededComponentIds: [],
      targetOnlyComponentIds: [],
      findings: validated.errors.map((reason) => ({
        state: "plan_validation_failed" as const,
        reason,
        requiredAction: "Repair the seeded substitution request and rerun validation.",
      })),
      planValidationErrors: validated.errors,
      pullList: validated.errors,
      prohibitedTransitions: [
        ...COMMONS_SEEDED_SUBSTITUTION_PROHIBITED_TRANSITIONS,
      ],
    };
  }

  const request = validated.value;
  const projectionResult = runCommonsComponentProjectionGate(
    request.projectionRequest,
  );
  const projectionResultDigest = computeCommonsProjectionResultDigest(
    projectionResult,
  );
  const graphGate = graphGateFromReceipt(request);
  const findings: CommonsSeededSubstitutionFinding[] = [];

  if (projectionResultDigest !== request.expectedProjectionResultDigest) {
    addFinding(
      findings,
      "projection_result_mismatch",
      "The expected component-projection digest does not match the recomputed result.",
      "Refresh the component-projection result and bind the plan to its canonical digest.",
    );
  }
  if (!projectionResult.seed || projectionResult.projectedComponents.length === 0) {
    addFinding(
      findings,
      "projection_seed_missing",
      "No admitted projected component is available to seed the substitution plan.",
      "Pass Commons component projection for at least one exact target component.",
    );
  }
  if (
    request.plan.caseId !==
    request.projectionRequest.transferRequest.targetCapabilityGraph.caseId
  ) {
    addFinding(
      findings,
      "plan_case_mismatch",
      "The substitution plan belongs to a different target case.",
      "Rebuild the plan under the target case identified by the projection request.",
    );
  }
  if (
    request.plan.capabilityGraphDigest !==
    request.projectionRequest.transferRequest.targetCapabilityGraphDigest
  ) {
    addFinding(
      findings,
      "graph_digest_mismatch",
      "The substitution plan references a different capability-graph digest.",
      "Regenerate the plan against the exact target graph used by Commons transfer.",
    );
  }

  const seededComponentIds = projectionResult.projectedComponents.map(
    (item) => item.candidate.id,
  );
  for (const projected of projectionResult.projectedComponents) {
    const component = request.plan.components.find(
      (candidate) => candidate.id === projected.candidate.id,
    );
    if (!component) {
      addFinding(
        findings,
        "seeded_component_missing",
        `Projected component ${projected.candidate.id} is absent from the substitution plan.`,
        "Include the exact projected component or rerun projection with a replacement candidate.",
        projected.candidate.id,
      );
      continue;
    }
    if (
      canonicalStringify(component) !==
      canonicalStringify(projected.candidate)
    ) {
      addFinding(
        findings,
        "seeded_component_mutated",
        `Projected component ${projected.candidate.id} changed after projection admission.`,
        "Restore the exact projected record or rerun projection for the changed component.",
        projected.candidate.id,
      );
    }
  }

  const globalBlocked = findings.length > 0;
  const targetOnlyComponentIds = request.plan.components
    .map((component) => component.id)
    .filter((id) => !seededComponentIds.includes(id));
  if (globalBlocked) {
    return {
      passed: false,
      state: "seeded_substitution_blocked",
      projectionResult,
      projectionResultDigest,
      graphGate,
      seededComponentIds,
      targetOnlyComponentIds,
      findings,
      planValidationErrors: [],
      plan: request.plan,
      pullList: dedupe(findings.map((finding) => finding.requiredAction)),
      prohibitedTransitions: [
        ...COMMONS_SEEDED_SUBSTITUTION_PROHIBITED_TRANSITIONS,
      ],
    };
  }

  const substitutionGate = runSubstitutionGate(
    request.plan,
    request.projectionRequest.transferRequest.targetCapabilityGraph,
    graphGate,
    request.projectionRequest.transferRequest.targetCapabilityGraphDigest,
    request.projectionRequest.targetClaimPacket,
  );
  const state = substitutionGate.passed
    ? "seeded_substitution_admitted"
    : "seeded_substitution_incomplete";

  return {
    passed: substitutionGate.passed,
    state,
    projectionResult,
    projectionResultDigest,
    graphGate,
    seededComponentIds,
    targetOnlyComponentIds,
    findings,
    planValidationErrors: [],
    substitutionGate,
    plan: request.plan,
    pullList: substitutionGate.pullList,
    prohibitedTransitions: [
      ...COMMONS_SEEDED_SUBSTITUTION_PROHIBITED_TRANSITIONS,
    ],
  };
}
