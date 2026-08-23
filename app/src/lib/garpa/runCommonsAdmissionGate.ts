import type {
  ArchitecturePattern,
  CapabilityPrimitive,
  CommonsAdmissionFinding,
  CommonsAdmissionRequest,
  CommonsAdmissionResult,
  ComponentObservation,
  ExecutionClass,
  PrimitiveQualificationRef,
} from "../../types/garpaCommons";

const EXECUTION_RANK: Record<ExecutionClass, number> = {
  E0_analysis_only: 0,
  E1_simulation_or_replay: 1,
  E2_bench_passive: 2,
  E3_controlled_field_inert: 3,
  E4_regulated_active: 4,
  E5_operational_environment: 5,
};

const QUALIFICATION_RANK: Record<PrimitiveQualificationRef["state"], number> = {
  candidate: 0,
  bench_observed: 1,
  field_observed: 2,
  repeated: 3,
};

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function addFinding(
  findings: CommonsAdmissionFinding[],
  state: CommonsAdmissionFinding["state"],
  objectType: CommonsAdmissionFinding["objectType"],
  objectId: string,
  reason: string,
  requiredAction: string,
): void {
  findings.push({ state, objectType, objectId, reason, requiredAction });
}

function qualificationComplete(ref: PrimitiveQualificationRef): boolean {
  return (
    Boolean(ref.qualificationContractDigest.trim()) &&
    ref.runReceiptIds.length > 0 &&
    ref.scenarioIds.length > 0 &&
    ref.metricIds.length > 0
  );
}

function sourceIncludesRequest(
  request: CommonsAdmissionRequest,
  sourceCaseIds: string[],
  sourceReleaseIds: string[],
): boolean {
  return (
    sourceCaseIds.includes(request.sourceCaseId) &&
    sourceReleaseIds.includes(request.sourceReleaseId)
  );
}

function primitiveEarned(primitive: CapabilityPrimitive): boolean {
  if (primitive.maturity === "concept") return true;
  if (primitive.maturity === "candidate") {
    return (
      primitive.observedImplementations.some((ref) => ref.componentIds.length > 0) ||
      primitive.qualificationRefs.length > 0
    );
  }

  const complete = primitive.qualificationRefs.filter(qualificationComplete);
  if (primitive.maturity === "bench_observed") {
    return complete.some(
      (ref) =>
        QUALIFICATION_RANK[ref.state] >= QUALIFICATION_RANK.bench_observed &&
        EXECUTION_RANK[ref.executionClass] >= EXECUTION_RANK.E2_bench_passive,
    );
  }
  if (primitive.maturity === "field_observed") {
    return complete.some(
      (ref) =>
        QUALIFICATION_RANK[ref.state] >= QUALIFICATION_RANK.field_observed &&
        EXECUTION_RANK[ref.executionClass] >=
          EXECUTION_RANK.E3_controlled_field_inert,
    );
  }

  const repeatedRefs = complete.filter(
    (ref) =>
      QUALIFICATION_RANK[ref.state] >= QUALIFICATION_RANK.bench_observed &&
      EXECUTION_RANK[ref.executionClass] >= EXECUTION_RANK.E2_bench_passive,
  );
  const distinctCases = new Set(repeatedRefs.map((ref) => ref.caseId));
  return (
    distinctCases.size >= 2 &&
    repeatedRefs.some((ref) => ref.state === "repeated")
  );
}

function localMetricComplete(observation: ComponentObservation): boolean {
  return (
    observation.metricResults.length > 0 &&
    observation.metricResults.every(
      (metric) =>
        metric.sampleCount > 0 &&
        metric.rawSampleArtifactIds.length > 0 &&
        metric.thresholdResult !== "not_measured",
    )
  );
}

function componentEarned(observation: ComponentObservation): boolean {
  if (observation.state === "vendor_claimed") return true;
  if (observation.state === "externally_reported") {
    return (
      observation.metricResults.length > 0 &&
      observation.metricResults.every(
        (metric) =>
          metric.value !== undefined && metric.thresholdResult !== "not_measured",
      )
    );
  }
  if (!observation.executionClass || observation.runReceiptIds.length === 0) {
    return false;
  }
  if (!localMetricComplete(observation)) return false;
  if (observation.state === "locally_observed") {
    return EXECUTION_RANK[observation.executionClass] >= EXECUTION_RANK.E1_simulation_or_replay;
  }
  return EXECUTION_RANK[observation.executionClass] >= EXECUTION_RANK.E2_bench_passive;
}

function genericIdentity(value: string | undefined): boolean {
  return ["", "unknown", "unspecified", "latest", "n/a", "na"].includes(
    normalize(value),
  );
}

function patternSupported(pattern: ArchitecturePattern): boolean {
  return (
    pattern.functionRoles.length > 0 &&
    pattern.interfaceRoles.length > 0 &&
    pattern.knownImplementationRefs.some((ref) => ref.componentIds.length > 0) &&
    pattern.failureModes.length > 0 &&
    pattern.residuals.length > 0
  );
}

function duplicateIdentityGroups<T>(
  items: T[],
  key: (item: T) => string,
): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const identity = key(item);
    groups.set(identity, [...(groups.get(identity) ?? []), item]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

export function runCommonsAdmissionGate(
  request: CommonsAdmissionRequest,
): CommonsAdmissionResult {
  const findings: CommonsAdmissionFinding[] = [];
  const blocked = new Set<string>();
  const allObjectIds = [
    ...request.primitives.map((item) => item.primitiveId),
    ...request.componentObservations.map((item) => item.observationId),
    ...request.architecturePatterns.map((item) => item.patternId),
  ];

  if (request.releaseVerificationState !== "current_valid") {
    addFinding(
      findings,
      "release_not_admissible",
      "request",
      request.sourceReleaseId,
      `Source release verification state is ${request.releaseVerificationState}.`,
      "Use the current valid governing release. Historical releases remain queryable but cannot seed the current commons.",
    );
    return {
      passed: false,
      admittedPrimitiveIds: [],
      admittedComponentObservationIds: [],
      admittedArchitecturePatternIds: [],
      blockedObjectIds: Array.from(new Set(allObjectIds)),
      findings,
    };
  }

  for (const group of duplicateIdentityGroups(
    request.primitives,
    (item) => `${normalize(item.name)}|${item.functionClass}`,
  )) {
    for (const item of group) {
      blocked.add(item.primitiveId);
      addFinding(
        findings,
        "duplicate_commons_identity",
        "primitive",
        item.primitiveId,
        "Another primitive in this request has the same normalized name and function class.",
        "Merge the source lineage into one primitive identity or use a genuinely distinct purpose and interface contract.",
      );
    }
  }

  for (const group of duplicateIdentityGroups(
    request.componentObservations,
    (item) =>
      [
        normalize(item.componentIdentity.manufacturer),
        normalize(item.componentIdentity.product),
        normalize(item.componentIdentity.exactModelOrVersion),
        normalize(item.componentIdentity.firmwareOrSoftwareVersion),
      ].join("|"),
  )) {
    for (const item of group) {
      blocked.add(item.observationId);
      addFinding(
        findings,
        "duplicate_commons_identity",
        "component_observation",
        item.observationId,
        "Another component observation in this request has the same exact component identity.",
        "Preserve the observations as one versioned component identity with multiple scoped result cells.",
      );
    }
  }

  for (const group of duplicateIdentityGroups(
    request.architecturePatterns,
    (item) => `${normalize(item.name)}|${normalize(item.problemShape)}`,
  )) {
    for (const item of group) {
      blocked.add(item.patternId);
      addFinding(
        findings,
        "duplicate_commons_identity",
        "architecture_pattern",
        item.patternId,
        "Another architecture pattern in this request has the same normalized name and problem shape.",
        "Merge the support lineage or narrow the pattern until its problem shape is distinct.",
      );
    }
  }

  for (const primitive of request.primitives) {
    if (
      !sourceIncludesRequest(
        request,
        primitive.sourceCaseIds,
        primitive.sourceReleaseIds,
      )
    ) {
      blocked.add(primitive.primitiveId);
      addFinding(
        findings,
        "source_scope_mismatch",
        "primitive",
        primitive.primitiveId,
        "Primitive source lineage does not include the release being admitted.",
        "Add the exact source case and release or submit the primitive under the release that actually supports it.",
      );
    }
    if (
      primitive.residuals.length === 0 ||
      primitive.falsificationConditions.length === 0
    ) {
      blocked.add(primitive.primitiveId);
      addFinding(
        findings,
        "primitive_residual_missing",
        "primitive",
        primitive.primitiveId,
        "Primitive omits its residual or falsification conditions.",
        "State what the primitive does not establish and the observation that would overturn its maturity claim.",
      );
    }
    if (
      primitive.inputInterfacePatterns.length +
        primitive.outputInterfacePatterns.length ===
        0 ||
      !primitiveEarned(primitive)
    ) {
      blocked.add(primitive.primitiveId);
      addFinding(
        findings,
        "primitive_maturity_unearned",
        "primitive",
        primitive.primitiveId,
        `Primitive maturity ${primitive.maturity} is not supported by its implementation and qualification references.`,
        "Lower the maturity or attach complete versioned qualification references at the required execution class and lineage depth.",
      );
    }
  }

  for (const observation of request.componentObservations) {
    if (
      observation.sourceCaseId !== request.sourceCaseId ||
      observation.sourceReleaseId !== request.sourceReleaseId ||
      observation.sourceReleaseDigest !== request.sourceReleaseDigest
    ) {
      blocked.add(observation.observationId);
      addFinding(
        findings,
        "source_scope_mismatch",
        "component_observation",
        observation.observationId,
        "Component observation source case, release, or release digest does not match the admission request.",
        "Bind the observation to the exact release that carries its fixture and result custody.",
      );
    }
    if (
      genericIdentity(observation.componentIdentity.product) ||
      genericIdentity(observation.componentIdentity.exactModelOrVersion)
    ) {
      blocked.add(observation.observationId);
      addFinding(
        findings,
        "component_identity_incomplete",
        "component_observation",
        observation.observationId,
        "Component identity is generic or unresolved.",
        "Record the exact product and model or software version before reuse.",
      );
    }
    const local =
      observation.state === "locally_observed" ||
      observation.state === "locally_qualified";
    if (
      observation.functionIds.length === 0 ||
      observation.interfaceIds.length === 0 ||
      (local &&
        (Object.keys(observation.environment).length === 0 ||
          genericIdentity(observation.fixture))) ||
      (local && observation.residuals.length === 0)
    ) {
      blocked.add(observation.observationId);
      addFinding(
        findings,
        "component_scope_incomplete",
        "component_observation",
        observation.observationId,
        "Component observation omits function, interface, fixture, environment, or residual scope required by its evidence state.",
        "Supply the exact fixture and environment, mapped functions and interfaces, and the limits of local observation.",
      );
    }
    if (!componentEarned(observation)) {
      blocked.add(observation.observationId);
      addFinding(
        findings,
        "component_state_unearned",
        "component_observation",
        observation.observationId,
        `Component state ${observation.state} is not supported by complete metrics, run receipts, and execution class.`,
        "Lower the evidence state or attach the versioned measurements and receipts required by that state.",
      );
    }
  }

  for (const pattern of request.architecturePatterns) {
    if (
      !sourceIncludesRequest(
        request,
        pattern.sourceCaseIds,
        pattern.sourceReleaseIds,
      )
    ) {
      blocked.add(pattern.patternId);
      addFinding(
        findings,
        "source_scope_mismatch",
        "architecture_pattern",
        pattern.patternId,
        "Architecture-pattern source lineage does not include the release being admitted.",
        "Attach the exact supporting release lineage or submit the pattern under the correct release.",
      );
    }
    if (
      !patternSupported(pattern) ||
      !pattern.knownImplementationRefs.some(
        (ref) =>
          ref.caseId === request.sourceCaseId &&
          ref.releaseId === request.sourceReleaseId,
      )
    ) {
      blocked.add(pattern.patternId);
      addFinding(
        findings,
        "pattern_support_incomplete",
        "architecture_pattern",
        pattern.patternId,
        "Architecture pattern lacks a current-release implementation, function/interface roles, failure modes, or residuals.",
        "Attach a versioned implementation and preserve the roles, constraints, failure modes, and residuals that bound reuse.",
      );
    }
  }

  const admittedPrimitiveIds = request.primitives
    .map((item) => item.primitiveId)
    .filter((id) => !blocked.has(id));
  const admittedComponentObservationIds = request.componentObservations
    .map((item) => item.observationId)
    .filter((id) => !blocked.has(id));
  const admittedArchitecturePatternIds = request.architecturePatterns
    .map((item) => item.patternId)
    .filter((id) => !blocked.has(id));

  return {
    passed: findings.length === 0,
    admittedPrimitiveIds,
    admittedComponentObservationIds,
    admittedArchitecturePatternIds,
    blockedObjectIds: Array.from(blocked),
    findings,
  };
}
