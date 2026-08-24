import type { BuildManifest } from "../../types/garpaBuild";
import type {
  CommonsSeededAsBuiltReceipt,
  CommonsSeededBuildReceiptFinding,
  CommonsSeededBuildReceiptRequest,
  CommonsSeededBuildReceiptResult,
  InstalledComponentReceipt,
} from "../../types/garpaCommonsSeededBuildReceipt";
import { canonicalStringify } from "./canonicalJson";
import { computeCommonsSeededAsBuiltReceiptDigest } from "./commonsSeededBuildReceiptDigest";
import { sha256Hex } from "./sha256";
import { runCommonsSeededBuildManifestGate } from "./runCommonsSeededBuildManifestGate";
import { validateCommonsSeededBuildReceiptRequest } from "./validateCommonsSeededBuildReceipt";

export const COMMONS_SEEDED_BUILD_RECEIPT_PROHIBITED_TRANSITIONS = [
  "A frozen build manifest is an expected configuration, not evidence that assembly occurred.",
  "An as-built receipt cannot transfer source qualification, calibration, execution authority, or mission-equivalence into the target case.",
  "Build-receipt admission does not authorize a test run, deployment, vendor parity, or publication; the next lawful state is target preflight.",
] as const;

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function exactSet(left: string[], right: string[]): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function addFinding(
  findings: CommonsSeededBuildReceiptFinding[],
  state: CommonsSeededBuildReceiptFinding["state"],
  reason: string,
  requiredAction: string,
  coordinates: Partial<CommonsSeededBuildReceiptFinding> = {},
): void {
  findings.push({ state, reason, requiredAction, ...coordinates });
}

function computePriorResultDigest(result: unknown): string {
  return sha256Hex(canonicalStringify(result));
}

function computeManifestDigest(manifest: BuildManifest): string {
  const { manifestDigest: _ignored, ...content } = manifest;
  return sha256Hex(canonicalStringify(content));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function priorBindings(request: CommonsSeededBuildReceiptRequest): Array<Record<string, unknown>> {
  const seeded = asRecord(request.seededBuildManifestRequest);
  const value = seeded.seededComponentBindings ?? seeded.seededBuildBindings;
  return Array.isArray(value) ? value.filter((item) => Object.keys(asRecord(item)).length > 0).map(asRecord) : [];
}

function seededComponentIds(
  request: CommonsSeededBuildReceiptRequest,
  priorResult: unknown,
): string[] {
  const result = asRecord(priorResult);
  for (const key of ["seededComponentIds", "boundSeededComponentIds"]) {
    const value = result[key];
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      return value as string[];
    }
  }
  return priorBindings(request)
    .map((binding) => String(binding.componentId ?? ""))
    .filter(Boolean);
}

function allReferencedArtifactIds(receipt: CommonsSeededAsBuiltReceipt): string[] {
  return [
    ...receipt.installedComponents.flatMap((item) => [
      ...item.acquisitionRecordIds,
      ...item.evidenceArtifactIds,
    ]),
    ...receipt.installedCustomCode.flatMap((item) => item.evidenceArtifactIds),
    ...receipt.calibrationReceipts.flatMap((item) => item.evidenceArtifactIds),
    ...receipt.assemblyStepReceipts.flatMap((item) => item.evidenceArtifactIds),
    ...receipt.substitutions.flatMap((item) => item.evidenceArtifactIds),
    ...receipt.deviations.flatMap((item) => item.evidenceArtifactIds),
    ...receipt.actualCosts.flatMap((item) => item.evidenceArtifactIds),
    ...receipt.labor.flatMap((item) => item.evidenceArtifactIds),
  ];
}

function componentFindings(
  manifest: BuildManifest,
  receipt: CommonsSeededAsBuiltReceipt,
  seededIds: ReadonlySet<string>,
  bindings: Array<Record<string, unknown>>,
): CommonsSeededBuildReceiptFinding[] {
  const findings: CommonsSeededBuildReceiptFinding[] = [];
  const installed = new Map(
    receipt.installedComponents.map((item) => [item.componentId, item]),
  );
  const bindingByComponent = new Map(
    bindings.map((binding) => [String(binding.componentId ?? ""), binding]),
  );

  for (const component of manifest.components) {
    const item = installed.get(component.componentId);
    if (!item) {
      addFinding(
        findings,
        "installed_component_missing",
        `Manifest component ${component.componentId} has no installed-component receipt.`,
        "Receipt the exact installed identity and evidence before preflight.",
        { componentId: component.componentId },
      );
      continue;
    }
    if (item.exactModelOrVersion !== component.exactModelOrVersion) {
      addFinding(
        findings,
        "installed_component_identity_mismatch",
        `Installed component ${component.componentId} does not match manifest version ${component.exactModelOrVersion}.`,
        "Return the changed component through architecture review and freeze a successor manifest.",
        { componentId: component.componentId },
      );
    }
    if (item.quantity !== component.quantity) {
      addFinding(
        findings,
        "installed_component_quantity_mismatch",
        `Installed quantity for ${component.componentId} differs from the frozen manifest.`,
        "Reconcile the physical inventory or supersede the manifest.",
        { componentId: component.componentId },
      );
    }
    if (item.configurationDigest !== component.configurationDigest) {
      addFinding(
        findings,
        "installed_component_configuration_mismatch",
        `Installed configuration for ${component.componentId} differs from the frozen manifest.`,
        "Restore the frozen configuration or return through architecture and qualification.",
        { componentId: component.componentId },
      );
    }
    if (
      (component.firmwareOrRuntimeVersion ?? "") !==
      (item.firmwareOrRuntimeVersion ?? "")
    ) {
      addFinding(
        findings,
        "installed_component_firmware_mismatch",
        `Installed firmware or runtime for ${component.componentId} differs from the frozen manifest.`,
        "Restore the exact version or create a successor projection, architecture, qualification, and manifest chain.",
        { componentId: component.componentId },
      );
    }
    if (
      component.serialOrLotPolicy === "record_each" &&
      item.serialOrLotIds.length < component.quantity
    ) {
      addFinding(
        findings,
        "installed_component_serial_custody_missing",
        `Installed hardware ${component.componentId} lacks one serial or lot identifier per unit.`,
        "Record every installed unit before preflight.",
        { componentId: component.componentId },
      );
    }
    if (item.evidenceArtifactIds.length === 0) {
      addFinding(
        findings,
        "installed_component_evidence_missing",
        `Installed component ${component.componentId} has no as-built evidence artifact.`,
        "Attach inventory, installation, and configuration evidence with immutable digests.",
        { componentId: component.componentId },
      );
    }
    if (seededIds.has(component.componentId)) {
      const binding = bindingByComponent.get(component.componentId);
      if (binding && item.bindingId !== String(binding.bindingId ?? "")) {
        addFinding(
          findings,
          "seeded_source_mismatch" as CommonsSeededBuildReceiptFinding["state"],
          `Installed seeded component ${component.componentId} does not reference its governing build binding.`,
          "Use the exact seeded-component build binding retained by the admitted manifest result.",
          { componentId: component.componentId },
        );
      }
    }
  }

  const manifestIds = new Set(manifest.components.map((item) => item.componentId));
  for (const item of receipt.installedComponents) {
    if (!manifestIds.has(item.componentId)) {
      addFinding(
        findings,
        "installed_component_unexpected",
        `Installed component ${item.componentId} is absent from the frozen manifest.`,
        "Return the additional component through target substitution and architecture admission.",
        { componentId: item.componentId },
      );
    }
  }
  return findings;
}

function customCodeFindings(
  manifest: BuildManifest,
  receipt: CommonsSeededAsBuiltReceipt,
): CommonsSeededBuildReceiptFinding[] {
  const findings: CommonsSeededBuildReceiptFinding[] = [];
  const installed = new Map(
    receipt.installedCustomCode.map((item) => [item.customCodeId, item]),
  );
  for (const code of manifest.customCode) {
    const item = installed.get(code.customCodeId);
    if (!item) {
      addFinding(
        findings,
        "installed_custom_code_missing",
        `Manifest custom-code package ${code.customCodeId} has no installed receipt.`,
        "Receipt the exact installed package, commit, locks, and configuration.",
        { customCodeId: code.customCodeId },
      );
      continue;
    }
    if (
      item.exactVersion !== code.exactVersion ||
      item.sourceCommit !== code.sourceCommit ||
      item.packageDigest !== code.packageDigest ||
      item.dependencyLockDigest !== code.dependencyLockDigest ||
      item.configurationDigest !== code.configurationDigest
    ) {
      addFinding(
        findings,
        "installed_custom_code_mismatch",
        `Installed custom code ${code.customCodeId} differs from the frozen package custody.`,
        "Restore the exact package or supersede the architecture, qualification, and manifest chain.",
        { customCodeId: code.customCodeId },
      );
    }
  }
  return findings;
}

function calibrationFindings(
  manifest: BuildManifest,
  receipt: CommonsSeededAsBuiltReceipt,
): CommonsSeededBuildReceiptFinding[] {
  const findings: CommonsSeededBuildReceiptFinding[] = [];
  const byId = new Map(
    receipt.calibrationReceipts.map((item) => [item.calibrationPlanId, item]),
  );
  for (const plan of manifest.calibrationPlan) {
    const item = byId.get(plan.id);
    if (!item) {
      addFinding(
        findings,
        "calibration_receipt_missing",
        `Calibration-plan item ${plan.id} has no execution receipt.`,
        "Execute and receipt the frozen calibration plan before preflight.",
        { calibrationPlanId: plan.id },
      );
      continue;
    }
    if (item.subjectId !== plan.subjectId || item.state !== "passed") {
      addFinding(
        findings,
        "calibration_receipt_failed",
        `Calibration-plan item ${plan.id} did not pass for the frozen subject.`,
        "Resolve the calibration failure and retain the failed receipt before rerunning.",
        { calibrationPlanId: plan.id },
      );
    }
    if (item.evidenceArtifactIds.length === 0) {
      addFinding(
        findings,
        "calibration_receipt_missing",
        `Calibration-plan item ${plan.id} lacks evidence-artifact custody.`,
        "Attach the calibration artifacts named by the frozen plan.",
        { calibrationPlanId: plan.id },
      );
    }
  }
  return findings;
}

function assemblyFindings(
  manifest: BuildManifest,
  receipt: CommonsSeededAsBuiltReceipt,
): CommonsSeededBuildReceiptFinding[] {
  const findings: CommonsSeededBuildReceiptFinding[] = [];
  const byId = new Map(
    receipt.assemblyStepReceipts.map((item) => [item.assemblyStepId, item]),
  );
  for (const step of manifest.assemblySteps) {
    const item = byId.get(step.id);
    if (!item) {
      addFinding(
        findings,
        "assembly_step_receipt_missing",
        `Assembly step ${step.id} has no execution receipt.`,
        "Execute or explicitly block the frozen assembly step before preflight.",
        { assemblyStepId: step.id },
      );
      continue;
    }
    if (item.state !== "passed") {
      addFinding(
        findings,
        "assembly_step_receipt_failed",
        `Assembly step ${step.id} did not pass.`,
        "Retain the failure and rework or supersede the build before preflight.",
        { assemblyStepId: step.id },
      );
    }
    if (
      !exactSet(item.componentIds, step.componentIds) ||
      !exactSet(item.customCodeIds, step.customCodeIds) ||
      !exactSet(item.compatibilityEdgeIds, step.compatibilityEdgeIds)
    ) {
      addFinding(
        findings,
        "assembly_step_scope_mismatch",
        `Assembly receipt ${step.id} does not cover the exact frozen step scope.`,
        "Receipt every frozen component, code package, and compatibility edge under the same step identifier.",
        { assemblyStepId: step.id },
      );
    }
    if (item.evidenceArtifactIds.length === 0) {
      addFinding(
        findings,
        "assembly_step_receipt_missing",
        `Assembly step ${step.id} lacks evidence-artifact custody.`,
        "Attach immutable assembly evidence before preflight.",
        { assemblyStepId: step.id },
      );
    }
  }
  return findings;
}

export function runCommonsSeededBuildReceiptGate(
  input: CommonsSeededBuildReceiptRequest | unknown,
): CommonsSeededBuildReceiptResult {
  const validated = validateCommonsSeededBuildReceiptRequest(input);
  if (!validated.ok || !validated.value) {
    return {
      passed: false,
      state: "seeded_build_receipt_blocked",
      seededBuildManifestResultDigest: "",
      asBuiltReceiptDigest: "",
      buildManifestDigest: "",
      installedComponentIds: [],
      receiptedAssemblyStepIds: [],
      receiptedCalibrationPlanIds: [],
      substitutedComponentIds: [],
      findings: validated.errors.map((reason) => ({
        state: "as_built_validation_failed" as const,
        reason,
        requiredAction: "Repair the seeded as-built request and rerun validation.",
      })),
      validationErrors: validated.errors,
      pullList: validated.errors,
      prohibitedTransitions: [...COMMONS_SEEDED_BUILD_RECEIPT_PROHIBITED_TRANSITIONS],
    };
  }

  const request = validated.value;
  const priorResult = runCommonsSeededBuildManifestGate(
    request.seededBuildManifestRequest,
  );
  const priorDigest = computePriorResultDigest(priorResult);
  const receipt = request.asBuiltReceipt;
  const receiptDigest = computeCommonsSeededAsBuiltReceiptDigest(receipt);
  const manifest = request.seededBuildManifestRequest.buildManifest;
  const manifestDigest = computeManifestDigest(manifest);
  const findings: CommonsSeededBuildReceiptFinding[] = [];

  if (priorDigest !== request.expectedSeededBuildManifestResultDigest ||
      receipt.seededBuildManifestResultDigest !== priorDigest) {
    addFinding(
      findings,
      "seeded_build_manifest_result_mismatch",
      "The expected or receipted seeded build-manifest result digest does not match deterministic recomputation.",
      "Refresh the admitted build-manifest result and bind the receipt to its canonical digest.",
    );
  }
  if (!priorResult.passed || !priorResult.buildManifestGate?.passed) {
    addFinding(
      findings,
      "seeded_build_manifest_not_admitted",
      "The governing Commons-seeded build manifest is not admitted for assembly.",
      "Resolve every build-custody and existing build-manifest finding before receipting assembly.",
    );
  }
  if (receipt.receiptDigest !== receiptDigest) {
    addFinding(
      findings,
      "as_built_receipt_digest_mismatch",
      "The as-built receipt digest does not match its canonical content.",
      "Recompute the receipt digest after restoring the immutable as-built record.",
    );
  }
  if (receipt.caseId !== manifest.caseId) {
    addFinding(
      findings,
      "as_built_case_mismatch",
      "The as-built receipt belongs to a different target case.",
      "Receipt assembly under the exact admitted target case.",
    );
  }
  if (
    receipt.buildManifestDigest !== manifestDigest ||
    receipt.candidateArchitectureDigest !== manifest.candidateArchitectureDigest ||
    receipt.qualificationContractDigest !== manifest.qualificationContractDigest
  ) {
    addFinding(
      findings,
      "as_built_upstream_digest_mismatch",
      "The as-built receipt is not bound to the exact manifest, architecture, and qualification chain.",
      "Rebuild the receipt against the current frozen chain or supersede the build.",
    );
  }
  if (
    Date.parse(receipt.startedAt) < Date.parse(manifest.frozenAt) ||
    Date.parse(receipt.completedAt) < Date.parse(receipt.startedAt) ||
    Date.parse(request.admittedAt) < Date.parse(receipt.completedAt)
  ) {
    addFinding(
      findings,
      "as_built_time_order_invalid",
      "The receipt predates the frozen manifest, completes before it starts, or is admitted before completion.",
      "Restore chronological custody across manifest freeze, assembly, completion, and receipt admission.",
    );
  }

  const seededIds = new Set(seededComponentIds(request, priorResult));
  const bindings = priorBindings(request);
  findings.push(...componentFindings(manifest, receipt, seededIds, bindings));
  findings.push(...customCodeFindings(manifest, receipt));
  findings.push(...calibrationFindings(manifest, receipt));
  findings.push(...assemblyFindings(manifest, receipt));

  const policyByComponent = new Map(
    manifest.substitutionPolicies.map((item) => [item.componentId, item]),
  );
  for (const substitution of receipt.substitutions) {
    const policy = policyByComponent.get(substitution.originalComponentId);
    if (seededIds.has(substitution.originalComponentId)) {
      addFinding(
        findings,
        "seeded_component_substitution_forbidden",
        `Seeded component ${substitution.originalComponentId} was replaced after target qualification and manifest freeze.`,
        "Return the replacement through Commons projection, substitution, architecture, qualification, and a successor manifest.",
        { componentId: substitution.originalComponentId },
      );
    }
    if (!policy || policy.policy !== substitution.policy) {
      addFinding(
        findings,
        "substitution_policy_mismatch",
        `Executed substitution for ${substitution.originalComponentId} does not match the frozen policy.`,
        "Use the exact policy or return the change through architecture review.",
        { componentId: substitution.originalComponentId },
      );
    }
  }

  for (const deviation of receipt.deviations) {
    if (
      deviation.disposition === "blocked" ||
      deviation.approvalReceiptIds.length === 0 ||
      deviation.evidenceArtifactIds.length === 0 ||
      (deviation.affectedComponentIds.some((id) => seededIds.has(id)) &&
        deviation.disposition !== "reworked")
    ) {
      addFinding(
        findings,
        "deviation_unresolved",
        `Build deviation ${deviation.deviationId} remains unresolved or alters a seeded component without rework.`,
        "Rework the build to the frozen state or supersede the governing projection and manifest chain.",
      );
    }
  }

  const actualCostByLine = new Map(
    receipt.actualCosts.map((item) => [item.costLineId, item]),
  );
  for (const costLineId of manifest.expectedCostLineIds) {
    const item = actualCostByLine.get(costLineId);
    if (!item) {
      addFinding(
        findings,
        "actual_cost_trace_incomplete",
        `Expected architecture cost line ${costLineId} has no actual-cost receipt.`,
        "Record the actual amount or an evidenced zero value for every frozen cost line.",
      );
    } else if (item.evidenceArtifactIds.length === 0) {
      addFinding(
        findings,
        "actual_cost_evidence_missing",
        `Actual cost line ${costLineId} lacks evidence-artifact custody.`,
        "Attach the invoice, ledger, or bounded cost derivation.",
      );
    }
  }
  if (
    receipt.labor.length === 0 ||
    receipt.labor.some((item) => item.evidenceArtifactIds.length === 0)
  ) {
    addFinding(
      findings,
      "labor_evidence_missing",
      "Actual assembly and integration labor is absent or lacks evidence custody.",
      "Receipt actual labor by category and actor before preflight.",
    );
  }

  const artifactIds = new Set(receipt.artifacts.map((item) => item.artifactId));
  const unresolvedArtifactIds = allReferencedArtifactIds(receipt).filter(
    (id) => !artifactIds.has(id),
  );
  if (unresolvedArtifactIds.length > 0) {
    addFinding(
      findings,
      "artifact_custody_missing",
      `Receipt references unknown artifacts: ${dedupe(unresolvedArtifactIds).join(", ")}.`,
      "Add immutable artifact records for every referenced receipt object.",
    );
  }
  if (receipt.state !== "assembled") {
    addFinding(
      findings,
      "receipt_state_not_assembled",
      "The as-built receipt is not in the assembled state.",
      "Resolve assembly failures or supersede the build; do not advance to preflight.",
    );
  }
  if (receipt.qualificationTransferred !== false) {
    addFinding(
      findings,
      "qualification_transfer_attempted",
      "The receipt attempts to transfer qualification into the target as-built state.",
      "Keep qualification transfer structurally false and execute target preflight and tests.",
    );
  }
  if (receipt.missionEquivalenceClaimed !== false) {
    addFinding(
      findings,
      "mission_equivalence_attempted",
      "The receipt attempts to claim mission equivalence from assembly evidence.",
      "Keep mission equivalence structurally false until target test and evaluation receipts exist.",
    );
  }

  const envelopeStates = new Set<CommonsSeededBuildReceiptFinding["state"]>([
    "seeded_build_manifest_result_mismatch",
    "seeded_build_manifest_not_admitted",
    "as_built_receipt_digest_mismatch",
    "as_built_case_mismatch",
    "as_built_upstream_digest_mismatch",
    "qualification_transfer_attempted",
    "mission_equivalence_attempted",
  ]);
  const state = findings.length === 0
    ? "seeded_build_receipt_admitted"
    : findings.some((item) => envelopeStates.has(item.state))
      ? "seeded_build_receipt_blocked"
      : "seeded_build_receipt_incomplete";

  return {
    passed: state === "seeded_build_receipt_admitted",
    state,
    seededBuildManifestResult: priorResult,
    seededBuildManifestResultDigest: priorDigest,
    asBuiltReceiptDigest: receiptDigest,
    buildManifestDigest: manifestDigest,
    installedComponentIds: receipt.installedComponents.map((item) => item.componentId),
    receiptedAssemblyStepIds: receipt.assemblyStepReceipts.map((item) => item.assemblyStepId),
    receiptedCalibrationPlanIds: receipt.calibrationReceipts.map((item) => item.calibrationPlanId),
    substitutedComponentIds: receipt.substitutions.map((item) => item.originalComponentId),
    findings,
    validationErrors: [],
    asBuiltReceipt: receipt,
    pullList: dedupe(findings.map((item) => item.requiredAction)),
    prohibitedTransitions: [...COMMONS_SEEDED_BUILD_RECEIPT_PROHIBITED_TRANSITIONS],
  };
}
