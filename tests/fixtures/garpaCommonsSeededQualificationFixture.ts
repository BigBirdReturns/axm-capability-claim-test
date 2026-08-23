import admissionRequestRaw from "../../examples/garpa-commons/commons-request.json";
import admissionResultRaw from "../../examples/garpa-commons/commons-result.json";
import emptyCatalogRaw from "../../examples/garpa-commons-catalog/empty-catalog.json";
import operationsRaw from "../../examples/garpa-commons-catalog/operations.json";
import targetGraphRaw from "../../examples/garpa-commons-transfer/target-capability-graph.json";
import targetPacketRaw from "../../examples/garpa-synthetic-observation/claim-packet.json";
import candidateRaw from "../../examples/garpa-commons-component-projection/candidate.json";
import planRaw from "../../examples/garpa-commons-seeded-substitution/substitution-plan.json";
import architectureRaw from "../../examples/garpa-commons-seeded-architecture/candidate-architecture.json";
import targetOutcomeRaw from "../../examples/garpa-commons-seeded-qualification/target-mission-outcome.json";
import qualificationRaw from "../../examples/garpa-commons-seeded-qualification/qualification-contract.json";
import type { ClaimPacket, MissionOutcome } from "../../app/src/types/garpa";
import type { CandidateArchitecture } from "../../app/src/types/garpaArchitecture";
import type {
  CommonsAdmissionRequest,
  CommonsAdmissionResult,
  ComponentObservation,
} from "../../app/src/types/garpaCommons";
import type { CapabilityGraph } from "../../app/src/types/garpaCapability";
import type {
  CommonsCatalog,
  CommonsCatalogOperation,
  CommonsCatalogUpdateRequest,
} from "../../app/src/types/garpaCommonsCatalog";
import type { CommonsComponentProjectionRequest } from "../../app/src/types/garpaCommonsProjection";
import type { CommonsSeededArchitectureRequest } from "../../app/src/types/garpaCommonsSeededArchitecture";
import type { CommonsSeededQualificationRequest } from "../../app/src/types/garpaCommonsSeededQualification";
import type { CommonsSeededSubstitutionRequest } from "../../app/src/types/garpaCommonsSeededSubstitution";
import type {
  CapabilityGraphAdmissionReceipt,
  CommonsTransferNomination,
  CommonsTransferRequest,
} from "../../app/src/types/garpaCommonsTransfer";
import type { QualificationContract } from "../../app/src/types/garpaQualification";
import type {
  ComponentCandidate,
  SubstitutionPlan,
} from "../../app/src/types/garpaSubstitution";
import { applyCommonsCatalogUpdate } from "../../app/src/lib/garpa/applyCommonsCatalogUpdate";
import { buildCommonsRetrievalPlan } from "../../app/src/lib/garpa/buildCommonsRetrievalPlan";
import {
  computeCapabilityGraphDigest,
  computeGraphAdmissionReceiptDigest,
} from "../../app/src/lib/garpa/commonsCaseTransferDigest";
import { computeCommonsTransferResultDigest } from "../../app/src/lib/garpa/commonsComponentProjectionDigest";
import {
  computeArchitectureSelectionDigest,
  computeCommonsSeededArchitectureResultDigest,
  computeTargetCandidateArchitectureDigest,
  computeTargetMissionOutcomeDigest,
} from "../../app/src/lib/garpa/commonsSeededQualificationDigest";
import { computeCommonsProjectionResultDigest } from "../../app/src/lib/garpa/commonsSeededSubstitutionDigest";
import {
  computeCommonsSeededSubstitutionResultDigest,
  computeTargetSubstitutionPlanDigest,
} from "../../app/src/lib/garpa/commonsSeededArchitectureDigest";
import { runCommonsTransferGate } from "../../app/src/lib/garpa/runCommonsTransferGate";
import { runCommonsComponentProjectionGate } from "../../app/src/lib/garpa/runCommonsComponentProjectionGate";
import { runCommonsSeededSubstitutionGate } from "../../app/src/lib/garpa/runCommonsSeededSubstitutionGate";
import { runCommonsSeededArchitectureGate } from "../../app/src/lib/garpa/runCommonsSeededArchitectureGate";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function requireState(condition: unknown, detail: unknown): asserts condition {
  if (!condition) {
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
}

export const TARGET_ENVIRONMENT = {
  location: "controlled indoor fixture",
  lighting: "constant",
  background: "static",
  target_class: "synthetic-known-object-v1",
};

export function buildTargetMissionOutcome(): MissionOutcome {
  return clone(targetOutcomeRaw) as unknown as MissionOutcome;
}

export function buildTargetClaimPacket(): ClaimPacket {
  const packet = clone(targetPacketRaw) as unknown as ClaimPacket;
  const environment = packet.evidence.find((cell) => cell.id === "e4");
  if (environment) {
    environment.environment =
      "Controlled indoor fixture with constant lighting, static background, and target class synthetic-known-object-v1";
    environment.locator.description =
      "The target requirement fixes the indoor fixture, lighting, background, and target class.";
  }
  return packet;
}

function initialCatalog(): CommonsCatalog {
  const catalog = clone(emptyCatalogRaw) as unknown as CommonsCatalog;
  const update: CommonsCatalogUpdateRequest = {
    schemaVersion: 1,
    currentCatalog: catalog,
    expectedCatalogDigest: catalog.catalogDigest,
    admissionRequest: clone(admissionRequestRaw) as unknown as CommonsAdmissionRequest,
    admissionResult: clone(admissionResultRaw) as unknown as CommonsAdmissionResult,
    operations: clone(operationsRaw) as unknown as CommonsCatalogOperation[],
    actor: "GARPA seeded qualification fixture",
    updatedAt: "2026-08-23T05:30:00Z",
  };
  const result = applyCommonsCatalogUpdate(update);
  requireState(result.gate.passed && result.catalog, result.gate.findings);
  return result.catalog;
}

function graphReceipt(graph: CapabilityGraph): CapabilityGraphAdmissionReceipt {
  const content = {
    receiptId: "capability-graph-gate:GARPA-COMMONS-TARGET-0001:v1",
    capabilityGraphDigest: computeCapabilityGraphDigest(graph),
    passed: true,
    state: "admitted_for_substitution" as const,
  };
  return {
    ...content,
    receiptDigest: computeGraphAdmissionReceiptDigest(content),
  };
}

function componentNomination(
  catalog: CommonsCatalog,
): CommonsTransferNomination {
  const revision = catalog.componentObservationEntries[0]!.revisions[0]!;
  const source = revision.value as ComponentObservation;
  return {
    nominationId: "nominate-component-sensor-v1",
    objectType: "component_observation",
    catalogObjectId: catalog.componentObservationEntries[0]!.catalogObjectId,
    revisionId: revision.revisionId,
    objectDigest: revision.objectDigest,
    retrievalTaskIds: [
      "function:f-observe-target",
      "interface:i-world-target",
      "interface:i-observation-target",
    ],
    requestedUse: "component_retrieval_lead",
    targetFunctionIds: ["f-observe-target"],
    targetInterfaceIds: ["i-world-target", "i-observation-target"],
    mappingRationale:
      "The exact source observation nominates sensor-v1 for target-case evidence retrieval.",
    declaredEnvironmentComparison: "same",
    declaredExecutionComparison: "source_same_or_stronger",
    knownMismatches: [],
    acknowledgedResiduals: [...source.residuals],
    acknowledgedLimitations: [...source.limitations],
    acknowledgedFalsificationConditions: [],
    acknowledgedFailureModes: [],
    requiredEvidencePulls: [
      "Recover target-case identity, performance, availability, price, and security evidence for sensor-v1.",
    ],
    requiredQualificationTests: [
      "Re-run the target observation fixture and interface tests against the target graph and configuration.",
    ],
  };
}

function transferRequest(
  missionOutcomeDigest: string,
): CommonsTransferRequest {
  const catalog = initialCatalog();
  const graph = clone(targetGraphRaw) as unknown as CapabilityGraph;
  graph.missionOutcomeDigest = missionOutcomeDigest;
  const receipt = graphReceipt(graph);
  const graphDigest = computeCapabilityGraphDigest(graph);
  const retrieval = buildCommonsRetrievalPlan({
    catalog,
    expectedCatalogDigest: catalog.catalogDigest,
    targetCapabilityGraph: graph,
    targetCapabilityGraphDigest: graphDigest,
    targetGraphAdmissionReceipt: receipt,
  });
  requireState(retrieval.passed && retrieval.plan, retrieval.errors);
  return {
    schemaVersion: 1,
    catalog,
    expectedCatalogDigest: catalog.catalogDigest,
    targetCapabilityGraph: graph,
    targetCapabilityGraphDigest: graphDigest,
    targetGraphAdmissionReceipt: receipt,
    retrievalPlan: retrieval.plan,
    targetEnvironment: TARGET_ENVIRONMENT,
    targetExecutionClass: "E2_bench_passive",
    allowHistoricalResearch: false,
    nominations: [componentNomination(catalog)],
    createdAt: "2026-08-23T19:15:00Z",
  };
}

function projectionRequest(
  missionOutcomeDigest: string,
  packet: ClaimPacket,
): CommonsComponentProjectionRequest {
  const transfer = transferRequest(missionOutcomeDigest);
  const transferResult = runCommonsTransferGate(transfer);
  requireState(
    transferResult.candidateInputNominationIds.includes(
      "nominate-component-sensor-v1",
    ),
    transferResult,
  );
  return {
    schemaVersion: 1,
    transferRequest: transfer,
    expectedTransferResultDigest: computeCommonsTransferResultDigest(
      transferResult,
    ),
    targetClaimPacket: packet,
    projections: [
      {
        projectionId: "project-sensor-v1-target",
        nominationId: "nominate-component-sensor-v1",
        candidate: clone(candidateRaw) as unknown as ComponentCandidate,
      },
    ],
    projectedAt: "2026-08-23T19:20:00Z",
  };
}

function seededSubstitutionRequest(
  missionOutcomeDigest: string,
  packet: ClaimPacket,
): CommonsSeededSubstitutionRequest {
  const projection = projectionRequest(missionOutcomeDigest, packet);
  const projectionResult = runCommonsComponentProjectionGate(projection);
  requireState(projectionResult.passed, projectionResult);
  const plan = clone(planRaw) as unknown as SubstitutionPlan;
  plan.capabilityGraphDigest =
    projection.transferRequest.targetCapabilityGraphDigest;
  return {
    schemaVersion: 1,
    projectionRequest: projection,
    expectedProjectionResultDigest: computeCommonsProjectionResultDigest(
      projectionResult,
    ),
    plan,
    assembledAt: "2026-08-23T19:35:00Z",
  };
}

export function buildSeededArchitectureRequest(): {
  request: CommonsSeededArchitectureRequest;
  outcome: MissionOutcome;
  packet: ClaimPacket;
} {
  const outcome = buildTargetMissionOutcome();
  const packet = buildTargetClaimPacket();
  const missionOutcomeDigest = computeTargetMissionOutcomeDigest(outcome);
  const seeded = seededSubstitutionRequest(missionOutcomeDigest, packet);
  const seededResult = runCommonsSeededSubstitutionGate(seeded);
  requireState(seededResult.passed, seededResult);
  const architecture = clone(architectureRaw) as unknown as CandidateArchitecture;
  architecture.missionOutcomeDigest = missionOutcomeDigest;
  architecture.capabilityGraphDigest =
    seeded.projectionRequest.transferRequest.targetCapabilityGraphDigest;
  architecture.substitutionPlanDigest = computeTargetSubstitutionPlanDigest(
    seeded.plan,
  );
  const request: CommonsSeededArchitectureRequest = {
    schemaVersion: 1,
    seededSubstitutionRequest: seeded,
    expectedSeededSubstitutionResultDigest:
      computeCommonsSeededSubstitutionResultDigest(seededResult),
    architecture,
    assembledAt: "2026-08-23T19:50:00Z",
  };
  const result = runCommonsSeededArchitectureGate(request);
  requireState(result.passed, result);
  return { request, outcome, packet };
}

export function buildSeededQualificationRequest(): CommonsSeededQualificationRequest {
  const built = buildSeededArchitectureRequest();
  const seededArchitectureResult = runCommonsSeededArchitectureGate(
    built.request,
  );
  requireState(seededArchitectureResult.passed, seededArchitectureResult);
  const contract = clone(qualificationRaw) as unknown as QualificationContract;
  const missionOutcomeDigest = computeTargetMissionOutcomeDigest(built.outcome);
  const architectureDigest = computeTargetCandidateArchitectureDigest(
    built.request.architecture,
  );
  contract.missionOutcomeDigest = missionOutcomeDigest;
  contract.capabilityGraphDigest = built.request.architecture.capabilityGraphDigest;
  contract.candidateArchitectureDigest = architectureDigest;

  const projected = seededArchitectureResult.seededSubstitutionResult
    .projectionResult.projectedComponents[0]!;
  const selection = built.request.architecture.componentSelections.find(
    (item) => item.componentId === projected.candidate.id,
  )!;
  const risks = built.request.architecture.risks
    .filter((risk) => risk.affectedComponentIds.includes(projected.candidate.id))
    .map((risk) => risk.id);
  const residuals = built.request.architecture.residuals
    .filter((residual) =>
      residual.sourceComponentIds.includes(projected.candidate.id),
    )
    .map((residual) => residual.id);

  return {
    schemaVersion: 1,
    seededArchitectureRequest: built.request,
    expectedSeededArchitectureResultDigest:
      computeCommonsSeededArchitectureResultDigest(seededArchitectureResult),
    targetMissionOutcome: built.outcome,
    targetMissionOutcomeDigest: missionOutcomeDigest,
    qualificationContract: contract,
    seededComponentBindings: [
      {
        bindingId: "binding-sensor-v1-target-qualification",
        componentId: projected.candidate.id,
        sourceCatalogObjectId: projected.source.catalogObjectId,
        sourceRevisionId: projected.source.revisionId,
        sourceObjectDigest: projected.source.objectDigest,
        architectureSelectionDigest: computeArchitectureSelectionDigest(
          selection,
        ),
        riskIds: risks,
        residualIds: residuals,
        requiredTestClosures: projected.requiredQualificationTests.map(
          (requirement) => ({
            requirement,
            scenarioIds: ["scenario-target-nominal"],
            metricIds: ["q-target-detection", "q-target-latency"],
            rationale:
              "The frozen target scenario reruns the seeded sensor and both target interfaces under the exact target environment.",
          }),
        ),
      },
    ],
    frozenAt: contract.frozenAt,
  };
}
