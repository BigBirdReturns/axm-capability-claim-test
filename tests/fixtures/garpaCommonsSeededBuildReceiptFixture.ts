import type { BuildManifest } from "../../app/src/types/garpaBuild";
import type {
  AsBuiltArtifactRef,
  CommonsSeededAsBuiltReceipt,
  CommonsSeededBuildReceiptRequest,
} from "../../app/src/types/garpaCommonsSeededBuildReceipt";
import type { CommonsSeededBuildManifestRequest } from "../../app/src/types/garpaCommonsSeededBuildManifest";
import { canonicalStringify } from "../../app/src/lib/garpa/canonicalJson";
import { computeCommonsSeededAsBuiltReceiptDigest } from "../../app/src/lib/garpa/commonsSeededBuildReceiptDigest";
import { runCommonsSeededBuildManifestGate } from "../../app/src/lib/garpa/runCommonsSeededBuildManifestGate";
import { sha256Hex } from "../../app/src/lib/garpa/sha256";
import { buildSeededBuildManifestRequest } from "./garpaCommonsSeededBuildManifestFixture";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function after(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function manifestDigest(manifest: BuildManifest): string {
  const { manifestDigest: _ignored, ...content } = manifest;
  return sha256Hex(canonicalStringify(content));
}

function priorResultDigest(request: CommonsSeededBuildManifestRequest): string {
  const result = runCommonsSeededBuildManifestGate(request);
  if (!result.passed) throw new Error(JSON.stringify(result));
  return sha256Hex(canonicalStringify(result));
}

function bindingIdFor(
  request: CommonsSeededBuildManifestRequest,
  componentId: string,
): string | undefined {
  const record = request as unknown as Record<string, unknown>;
  const raw = record.seededComponentBindings ?? record.seededBuildBindings;
  if (!Array.isArray(raw)) return undefined;
  const binding = raw.find((item) => {
    const candidate = item as Record<string, unknown>;
    return candidate.componentId === componentId;
  }) as Record<string, unknown> | undefined;
  return typeof binding?.bindingId === "string" ? binding.bindingId : undefined;
}

function artifact(artifactId: string, capturedAt: string): AsBuiltArtifactRef {
  return {
    artifactId,
    sha256: sha256Hex(`artifact:${artifactId}`),
    mediaType: "application/json",
    path: `build-receipt/${artifactId}.json`,
    capturedAt,
  };
}

export function buildSeededBuildReceiptRequest(): CommonsSeededBuildReceiptRequest {
  const seededBuildManifestRequest = buildSeededBuildManifestRequest();
  const manifest = seededBuildManifestRequest.buildManifest;
  const seededBuildManifestResultDigest = priorResultDigest(
    seededBuildManifestRequest,
  );
  const startedAt = after(manifest.frozenAt, 5);
  const completedAt = after(manifest.frozenAt, 45);
  const admittedAt = after(manifest.frozenAt, 50);

  const artifacts: AsBuiltArtifactRef[] = [];
  const ensureArtifact = (id: string): string => {
    if (!artifacts.some((item) => item.artifactId === id)) {
      artifacts.push(artifact(id, completedAt));
    }
    return id;
  };

  const installedComponents = manifest.components.map((component, index) => {
    const evidenceArtifactId = ensureArtifact(`installed-${component.componentId}`);
    const acquisitionArtifactId = ensureArtifact(`acquisition-${component.componentId}`);
    return {
      componentId: component.componentId,
      bindingId: bindingIdFor(seededBuildManifestRequest, component.componentId),
      exactModelOrVersion: component.exactModelOrVersion,
      quantity: component.quantity,
      serialOrLotIds:
        component.serialOrLotPolicy === "record_each"
          ? Array.from(
              { length: component.quantity },
              (_, unit) => `${component.componentId}-serial-${String(unit + 1).padStart(3, "0")}`,
            )
          : [],
      firmwareOrRuntimeVersion: component.firmwareOrRuntimeVersion,
      configurationDigest: component.configurationDigest,
      supplierOrSource: component.supplierOrSource,
      actualUnitCost: component.unitCost,
      currency: component.currency,
      acquisitionRecordIds: [acquisitionArtifactId],
      installedAt: after(manifest.frozenAt, 10 + index),
      installedBy: "GARPA target build owner",
      evidenceArtifactIds: [evidenceArtifactId],
    };
  });

  const installedCustomCode = manifest.customCode.map((code, index) => ({
    customCodeId: code.customCodeId,
    exactVersion: code.exactVersion,
    sourceCommit: code.sourceCommit,
    packageDigest: code.packageDigest,
    dependencyLockDigest: code.dependencyLockDigest,
    configurationDigest: code.configurationDigest,
    installedAt: after(manifest.frozenAt, 15 + index),
    installedBy: "GARPA target build owner",
    evidenceArtifactIds: [ensureArtifact(`installed-code-${code.customCodeId}`)],
  }));

  const calibrationReceipts = manifest.calibrationPlan.map((plan, index) => ({
    calibrationPlanId: plan.id,
    subjectId: plan.subjectId,
    state: "passed" as const,
    executedAt: after(manifest.frozenAt, 20 + index),
    executedBy: plan.owner,
    evidenceArtifactIds: [ensureArtifact(`calibration-${plan.id}`)],
    notes: ["Frozen calibration method and acceptance condition satisfied."],
  }));

  const assemblyStepReceipts = manifest.assemblySteps.map((step, index) => ({
    assemblyStepId: step.id,
    state: "passed" as const,
    startedAt: after(manifest.frozenAt, 25 + index * 3),
    completedAt: after(manifest.frozenAt, 27 + index * 3),
    executedBy: step.owner,
    componentIds: [...step.componentIds],
    customCodeIds: [...step.customCodeIds],
    compatibilityEdgeIds: [...step.compatibilityEdgeIds],
    evidenceArtifactIds: [ensureArtifact(`assembly-${step.id}`)],
    deviationIds: [],
    rollbackPerformed: false,
    notes: ["Frozen procedure completed and acceptance condition satisfied."],
  }));

  const actualCosts = manifest.expectedCostLineIds.map((costLineId, index) => ({
    costLineId,
    amount: index === 0
      ? installedComponents.reduce(
          (total, component) => total + component.actualUnitCost * component.quantity,
          0,
        )
      : 25 + index * 10,
    currency: installedComponents[0]?.currency ?? "USD",
    evidenceArtifactIds: [ensureArtifact(`cost-${costLineId}`)],
  }));

  const labor = [
    {
      laborId: "labor-target-assembly",
      category: "assembly" as const,
      actor: "GARPA target build owner",
      hours: 3.5,
      evidenceArtifactIds: [ensureArtifact("labor-target-assembly")],
    },
    {
      laborId: "labor-target-integration",
      category: "integration" as const,
      actor: "GARPA target integration owner",
      hours: 2.25,
      evidenceArtifactIds: [ensureArtifact("labor-target-integration")],
    },
  ];

  const receipt: CommonsSeededAsBuiltReceipt = {
    schemaVersion: 1,
    receiptId: "as-built:GARPA-COMMONS-TARGET-0001:v1",
    caseId: manifest.caseId,
    seededBuildManifestResultDigest,
    buildManifestDigest: manifestDigest(manifest),
    candidateArchitectureDigest: manifest.candidateArchitectureDigest,
    qualificationContractDigest: manifest.qualificationContractDigest,
    installedComponents,
    installedCustomCode,
    calibrationReceipts,
    assemblyStepReceipts,
    substitutions: [],
    deviations: [],
    actualCosts,
    labor,
    artifacts,
    startedAt,
    completedAt,
    state: "assembled",
    qualificationTransferred: false,
    missionEquivalenceClaimed: false,
    receiptDigest: "0".repeat(64),
  };
  receipt.receiptDigest = computeCommonsSeededAsBuiltReceiptDigest(receipt);

  return {
    schemaVersion: 1,
    seededBuildManifestRequest: clone(seededBuildManifestRequest),
    expectedSeededBuildManifestResultDigest: seededBuildManifestResultDigest,
    asBuiltReceipt: receipt,
    admittedAt,
  };
}
