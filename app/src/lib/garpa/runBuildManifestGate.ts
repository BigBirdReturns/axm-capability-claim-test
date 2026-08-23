import type { CandidateArchitecture } from "../../types/garpaArchitecture";
import type {
  BuildManifest,
  BuildManifestGateResult,
} from "../../types/garpaBuild";
import type {
  QualificationContract,
  QualificationGateResult,
} from "../../types/garpaQualification";
import type { SubstitutionPlan } from "../../types/garpaSubstitution";

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function hasCycle(manifest: BuildManifest): boolean {
  const predecessors = new Map(
    manifest.assemblySteps.map((step) => [step.id, step.predecessorIds]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const predecessor of predecessors.get(id) ?? []) {
      if (visit(predecessor)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  return [...predecessors.keys()].some(visit);
}

function buildPullList(
  result: Omit<BuildManifestGateResult, "pullList">,
): string[] {
  const pulls: string[] = [];
  if (result.state === "qualification_not_admitted") {
    pulls.push(
      "Pass the frozen qualification-contract gate before creating an executable build manifest.",
    );
  }
  if (result.state === "upstream_digest_mismatch") {
    pulls.push(
      "Regenerate or supersede the build manifest against the current architecture and qualification digests.",
    );
  }
  for (const id of result.missingComponentIds) {
    pulls.push(`Add exact component ${id} to the build manifest.`);
  }
  pulls.push(...result.componentFindings);
  for (const id of result.missingCustomCodeIds) {
    pulls.push(
      `Add exact custom-code package ${id}, including commit and dependency-lock digests.`,
    );
  }
  pulls.push(...result.customCodeFindings);
  for (const id of result.missingCompatibilityEdgeIds) {
    pulls.push(
      `Carry compatibility edge ${id} and its qualification test into the manifest.`,
    );
  }
  for (const id of result.missingHumanRoleIds) {
    pulls.push(
      `Carry human role ${id}, training, responsibilities, and authority into the manifest.`,
    );
  }
  for (const id of result.missingDependencyIds) {
    pulls.push(
      `Carry external dependency ${id}, version, availability check, and fallback into the manifest.`,
    );
  }
  for (const id of result.missingInstrumentationIds) {
    pulls.push(
      `Add qualification instrument ${id} with exact version, configuration, calibration state, and storage path.`,
    );
  }
  pulls.push(...result.calibrationFindings);
  for (const id of result.missingSubstitutionPolicyIds) {
    pulls.push(`Define the governed replacement policy for component ${id}.`);
  }
  pulls.push(...result.assemblyFindings);
  for (const id of result.missingCostLineIds) {
    pulls.push(`Trace architecture cost line ${id} into the build manifest.`);
  }
  for (const id of result.missingScheduleLineIds) {
    pulls.push(`Trace architecture schedule line ${id} into the build manifest.`);
  }
  if (result.state === "manifest_not_frozen") {
    pulls.push(
      "Freeze and digest the build manifest before procurement or assembly begins.",
    );
  }
  return dedupe(pulls);
}

export function runBuildManifestGate(
  manifest: BuildManifest,
  architecture: CandidateArchitecture,
  plan: SubstitutionPlan,
  qualification: QualificationContract,
  qualificationGate: QualificationGateResult,
  expectedQualificationContractDigest: string,
): BuildManifestGateResult {
  const requiredArchitectureComponents = new Map(
    architecture.componentSelections.map((selection) => [
      selection.componentId,
      selection,
    ]),
  );
  const manifestComponents = new Map(
    manifest.components.map((component) => [component.componentId, component]),
  );
  const planComponents = new Map(
    plan.components.map((component) => [component.id, component]),
  );

  const missingComponentIds = [...requiredArchitectureComponents.keys()].filter(
    (id) => !manifestComponents.has(id),
  );
  const componentFindings: string[] = [];
  for (const [componentId, architectureSelection] of requiredArchitectureComponents) {
    const item = manifestComponents.get(componentId);
    const component = planComponents.get(componentId);
    if (!item || !component) continue;
    if (item.exactModelOrVersion !== component.exactModelOrVersion) {
      componentFindings.push(
        `Manifest component ${componentId} does not match substitution version ${component.exactModelOrVersion}.`,
      );
    }
    if (item.quantity !== architectureSelection.quantity) {
      componentFindings.push(
        `Manifest component ${componentId} quantity differs from the candidate architecture.`,
      );
    }
    for (const functionId of architectureSelection.functionIds) {
      if (!item.functionIds.includes(functionId)) {
        componentFindings.push(
          `Manifest component ${componentId} drops architecture function ${functionId}.`,
        );
      }
    }
    for (const interfaceId of architectureSelection.interfaceIds) {
      if (!item.interfaceIds.includes(interfaceId)) {
        componentFindings.push(
          `Manifest component ${componentId} drops architecture interface ${interfaceId}.`,
        );
      }
    }
    if (
      [
        "software_package",
        "open_source_project",
        "service",
        "custom_code",
      ].includes(component.kind) &&
      item.license !== component.license
    ) {
      componentFindings.push(
        `Manifest component ${componentId} does not preserve the admitted license.`,
      );
    }
    if (item.kind === "hardware" && item.serialOrLotPolicy !== "record_each") {
      componentFindings.push(
        `Hardware component ${componentId} does not require serial or lot custody.`,
      );
    }
  }

  const requiredCustomCodeIds = new Set(
    architecture.customCodeSelections.map((selection) => selection.customCodeId),
  );
  const manifestCode = new Map(
    manifest.customCode.map((item) => [item.customCodeId, item]),
  );
  const planCode = new Map(plan.customCode.map((item) => [item.id, item]));
  const missingCustomCodeIds = [...requiredCustomCodeIds].filter(
    (id) => !manifestCode.has(id),
  );
  const customCodeFindings: string[] = [];
  for (const customCodeId of requiredCustomCodeIds) {
    const item = manifestCode.get(customCodeId);
    const code = planCode.get(customCodeId);
    if (!item || !code) continue;
    if (item.exactVersion !== code.version) {
      customCodeFindings.push(
        `Manifest custom code ${customCodeId} does not match substitution version ${code.version}.`,
      );
    }
    if (
      !item.sourceCommit.trim() ||
      !item.packageDigest.trim() ||
      !item.dependencyLockDigest.trim() ||
      !item.configurationDigest.trim()
    ) {
      customCodeFindings.push(
        `Manifest custom code ${customCodeId} lacks complete version and digest custody.`,
      );
    }
  }

  const requiredCompatibilityIds = new Set(
    architecture.compatibilitySelections.map(
      (selection) => selection.compatibilityEdgeId,
    ),
  );
  const manifestCompatibilityIds = new Set(
    manifest.compatibilityEdges.map((edge) => edge.compatibilityEdgeId),
  );
  const missingCompatibilityEdgeIds = [...requiredCompatibilityIds].filter(
    (id) => !manifestCompatibilityIds.has(id),
  );

  const requiredRoleIds = new Set(
    architecture.humanRoleSelections.map((selection) => selection.humanRoleId),
  );
  const manifestRoleIds = new Set(
    manifest.humanRoles.map((role) => role.humanRoleId),
  );
  const missingHumanRoleIds = [...requiredRoleIds].filter(
    (id) => !manifestRoleIds.has(id),
  );

  const requiredDependencyIds = new Set(
    architecture.dependencySelections.map((selection) => selection.dependencyId),
  );
  const manifestDependencyIds = new Set(
    manifest.dependencies.map((dependency) => dependency.dependencyId),
  );
  const missingDependencyIds = [...requiredDependencyIds].filter(
    (id) => !manifestDependencyIds.has(id),
  );

  const requiredInstrumentationIds = new Set(
    qualification.instrumentation.map((instrument) => instrument.id),
  );
  const manifestInstrumentation = new Map(
    manifest.instrumentation.map((instrument) => [
      instrument.instrumentationId,
      instrument,
    ]),
  );
  const missingInstrumentationIds = [...requiredInstrumentationIds].filter(
    (id) => !manifestInstrumentation.has(id),
  );
  const calibrationFindings: string[] = [];
  for (const instrument of qualification.instrumentation) {
    const item = manifestInstrumentation.get(instrument.id);
    if (!item) continue;
    if (item.exactModelOrVersion !== instrument.modelOrVersion) {
      calibrationFindings.push(
        `Manifest instrument ${instrument.id} does not match qualification version ${instrument.modelOrVersion}.`,
      );
    }
    if (item.calibrationState !== instrument.calibrationState) {
      calibrationFindings.push(
        `Manifest instrument ${instrument.id} changes the qualification calibration state.`,
      );
    }
    if (item.storagePath !== instrument.storagePath) {
      calibrationFindings.push(
        `Manifest instrument ${instrument.id} changes the qualification storage path.`,
      );
    }
  }

  const calibrationSubjects = new Set(
    manifest.calibrationPlan.map((item) => item.subjectId),
  );
  for (const component of manifest.components) {
    if (
      component.calibrationRequired &&
      !calibrationSubjects.has(component.componentId)
    ) {
      calibrationFindings.push(
        `Component ${component.componentId} requires calibration but has no calibration-plan item.`,
      );
    }
  }
  for (const instrument of manifest.instrumentation) {
    if (
      instrument.calibrationState === "current" &&
      !calibrationSubjects.has(instrument.instrumentationId)
    ) {
      calibrationFindings.push(
        `Current instrument ${instrument.instrumentationId} has no preflight calibration-plan item.`,
      );
    }
  }

  const policyComponentIds = new Set(
    manifest.substitutionPolicies.map((policy) => policy.componentId),
  );
  const missingSubstitutionPolicyIds = [
    ...requiredArchitectureComponents.keys(),
  ].filter((id) => !policyComponentIds.has(id));

  const coveredComponents = new Set(
    manifest.assemblySteps.flatMap((step) => step.componentIds),
  );
  const coveredCode = new Set(
    manifest.assemblySteps.flatMap((step) => step.customCodeIds),
  );
  const coveredEdges = new Set(
    manifest.assemblySteps.flatMap((step) => step.compatibilityEdgeIds),
  );
  const assemblyFindings: string[] = [];
  for (const componentId of requiredArchitectureComponents.keys()) {
    if (!coveredComponents.has(componentId)) {
      assemblyFindings.push(
        `Assembly steps never install or verify component ${componentId}.`,
      );
    }
  }
  for (const customCodeId of requiredCustomCodeIds) {
    if (!coveredCode.has(customCodeId)) {
      assemblyFindings.push(
        `Assembly steps never install or verify custom code ${customCodeId}.`,
      );
    }
  }
  for (const edgeId of requiredCompatibilityIds) {
    if (!coveredEdges.has(edgeId)) {
      assemblyFindings.push(
        `Assembly steps never verify compatibility edge ${edgeId}.`,
      );
    }
  }
  if (hasCycle(manifest)) {
    assemblyFindings.push(
      "The build-manifest assembly sequence contains a predecessor cycle.",
    );
  }

  const expectedCostIds = new Set(manifest.expectedCostLineIds);
  const missingCostLineIds = architecture.costEnvelope.lines
    .map((line) => line.id)
    .filter((id) => !expectedCostIds.has(id));
  const expectedScheduleIds = new Set(manifest.expectedScheduleLineIds);
  const missingScheduleLineIds = architecture.scheduleEnvelope.lines
    .map((line) => line.id)
    .filter((id) => !expectedScheduleIds.has(id));

  const state = !qualificationGate.passed
    ? "qualification_not_admitted"
    : manifest.candidateArchitectureDigest !==
          qualification.candidateArchitectureDigest ||
        manifest.qualificationContractDigest !==
          expectedQualificationContractDigest
      ? "upstream_digest_mismatch"
      : missingComponentIds.length > 0 || componentFindings.length > 0
        ? "component_manifest_incomplete"
        : missingCustomCodeIds.length > 0 || customCodeFindings.length > 0
          ? "custom_code_manifest_incomplete"
          : missingCompatibilityEdgeIds.length > 0
            ? "compatibility_manifest_incomplete"
            : missingHumanRoleIds.length > 0
              ? "human_role_manifest_incomplete"
              : missingDependencyIds.length > 0
                ? "dependency_manifest_incomplete"
                : missingInstrumentationIds.length > 0
                  ? "instrumentation_manifest_incomplete"
                  : calibrationFindings.length > 0
                    ? "calibration_plan_incomplete"
                    : missingSubstitutionPolicyIds.length > 0
                      ? "substitution_policy_incomplete"
                      : assemblyFindings.length > 0
                        ? "assembly_plan_incomplete"
                        : missingCostLineIds.length > 0 ||
                            missingScheduleLineIds.length > 0
                          ? "cost_or_schedule_trace_incomplete"
                          : manifest.state !== "frozen"
                            ? "manifest_not_frozen"
                            : "admitted_for_assembly";

  const withoutPulls: Omit<BuildManifestGateResult, "pullList"> = {
    state,
    passed: state === "admitted_for_assembly",
    missingComponentIds,
    componentFindings: dedupe(componentFindings),
    missingCustomCodeIds,
    customCodeFindings: dedupe(customCodeFindings),
    missingCompatibilityEdgeIds,
    missingHumanRoleIds,
    missingDependencyIds,
    missingInstrumentationIds,
    calibrationFindings: dedupe(calibrationFindings),
    missingSubstitutionPolicyIds,
    assemblyFindings: dedupe(assemblyFindings),
    missingCostLineIds,
    missingScheduleLineIds,
  };
  return { ...withoutPulls, pullList: buildPullList(withoutPulls) };
}
