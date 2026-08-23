import type {
  CommonsSubstitutionSeedFinding,
  CommonsSubstitutionSeedRequest,
  CommonsSubstitutionSeedResult,
} from "../../types/garpaCommonsSubstitutionSeed";
import type { SubstitutionPlan } from "../../types/garpaSubstitution";
import { canonicalStringify } from "./canonicalJson";

export const COMMONS_SUBSTITUTION_SEED_PROHIBITED_TRANSITIONS = [
  "Seeding a ComponentCandidate does not admit component evidence, function coverage, interface coverage, compatibility, custom code, cost boundaries, or substitution options.",
  "The seeded plan must pass validateSubstitutionPlan and runSubstitutionGate under the target case.",
  "The seed operation cannot create an architecture selection, procurement authority, qualification state, execution authority, mission-equivalence claim, vendor-parity claim, or publication authority.",
] as const;

function finding(
  state: CommonsSubstitutionSeedFinding["state"],
  reason: string,
  requiredAction: string,
): CommonsSubstitutionSeedFinding {
  return { state, reason, requiredAction };
}

function shallowPlanErrors(plan: SubstitutionPlan): string[] {
  const errors: string[] = [];
  if (plan.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!plan.caseId.trim()) errors.push("caseId is required");
  if (!plan.capabilityGraphDigest.trim()) errors.push("capabilityGraphDigest is required");
  if (!Array.isArray(plan.components)) errors.push("components must be an array");
  if (!Array.isArray(plan.customCode)) errors.push("customCode must be an array");
  if (!Array.isArray(plan.compatibilityEdges)) errors.push("compatibilityEdges must be an array");
  if (!Array.isArray(plan.options)) errors.push("options must be an array");
  if (!plan.costBoundary || typeof plan.costBoundary !== "object") {
    errors.push("costBoundary is required");
  }
  if (!Array.isArray(plan.exclusions)) errors.push("exclusions must be an array");
  return errors;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function seedCommonsProjectionIntoSubstitutionPlan(
  request: CommonsSubstitutionSeedRequest,
): CommonsSubstitutionSeedResult {
  const findings: CommonsSubstitutionSeedFinding[] = [];
  const projection = request.projectionResult;
  if (!projection.passed || !projection.projected) {
    findings.push(
      finding(
        "projection_not_admitted",
        "The projection gate did not admit a target ComponentCandidate.",
        "Repair and rerun the Commons component projection gate.",
      ),
    );
  } else if (projection.readiness !== "substitution_ready") {
    findings.push(
      finding(
        "projection_not_substitution_ready",
        "The projected component still has target evidence obligations.",
        "Close every withheld target field and rerun component projection.",
      ),
    );
  }

  const planErrors = shallowPlanErrors(request.targetPlan);
  if (planErrors.length > 0) {
    findings.push(
      finding(
        "target_plan_invalid",
        planErrors.join("; "),
        "Supply a structurally valid target SubstitutionPlan envelope.",
      ),
    );
  }
  if (request.targetPlan.caseId !== request.expectedTargetCaseId) {
    findings.push(
      finding(
        "target_case_mismatch",
        "The target plan case does not match the expected target case.",
        "Use the SubstitutionPlan owned by the projection target case.",
      ),
    );
  }
  if (
    projection.projected &&
    projection.projected.targetCaseId !== request.expectedTargetCaseId
  ) {
    findings.push(
      finding(
        "target_case_mismatch",
        "The projected component belongs to a different target case.",
        "Use the exact projection produced for this SubstitutionPlan case.",
      ),
    );
  }
  if (
    request.targetPlan.capabilityGraphDigest !== request.expectedCapabilityGraphDigest
  ) {
    findings.push(
      finding(
        "capability_graph_digest_mismatch",
        "The target SubstitutionPlan references a different capability graph.",
        "Rebuild the plan envelope against the current admitted target graph.",
      ),
    );
  }

  const component = projection.projected?.component;
  const existing = component
    ? request.targetPlan.components.find((item) => item.id === component.id)
    : undefined;
  if (
    component &&
    existing &&
    canonicalStringify(existing) !== canonicalStringify(component)
  ) {
    findings.push(
      finding(
        "component_identity_conflict",
        "The target plan already contains the projected component id with different content.",
        "Resolve the target component identity explicitly; do not overwrite the existing candidate.",
      ),
    );
  }

  if (findings.length > 0 || !component || !projection.projected) {
    return {
      passed: false,
      state: findings[0]?.state ?? "projection_not_admitted",
      findings,
      downstreamSubstitutionGateRequired: true,
      prohibitedTransitions: [...COMMONS_SUBSTITUTION_SEED_PROHIBITED_TRANSITIONS],
    };
  }

  if (existing) {
    return {
      passed: true,
      state: "substitution_plan_noop",
      findings: [],
      noopComponentId: component.id,
      plan: clone(request.targetPlan),
      downstreamSubstitutionGateRequired: true,
      prohibitedTransitions: [...COMMONS_SUBSTITUTION_SEED_PROHIBITED_TRANSITIONS],
    };
  }

  const plan = clone(request.targetPlan);
  plan.components.push(clone(component));
  return {
    passed: true,
    state: "substitution_plan_seeded",
    findings: [],
    insertedComponentId: component.id,
    plan,
    downstreamSubstitutionGateRequired: true,
    prohibitedTransitions: [...COMMONS_SUBSTITUTION_SEED_PROHIBITED_TRANSITIONS],
  };
}
