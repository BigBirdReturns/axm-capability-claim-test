import { describe, expect, it } from "vitest";
import admissionRequestRaw from "../../examples/garpa-commons/commons-request.json";
import admissionResultRaw from "../../examples/garpa-commons/commons-result.json";
import emptyCatalogRaw from "../../examples/garpa-commons-catalog/empty-catalog.json";
import operationsRaw from "../../examples/garpa-commons-catalog/operations.json";
import targetGraphRaw from "../../examples/garpa-commons-transfer/target-capability-graph.json";
import targetPacketRaw from "../../examples/garpa-synthetic-observation/claim-packet.json";
import candidateRaw from "../../examples/garpa-commons-component-projection/candidate.json";
import planRaw from "../../examples/garpa-commons-seeded-substitution/substitution-plan.json";
import architectureRaw from "../../examples/garpa-commons-seeded-architecture/candidate-architecture.json";
import type { ClaimPacket } from "../../app/src/types/garpa";
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
import type { CommonsSeededSubstitutionRequest } from "../../app/src/types/garpaCommonsSeededSubstitution";
import type {
  CapabilityGraphAdmissionReceipt,
  CommonsTransferNomination,
  CommonsTransferRequest,
} from "../../app/src/types/garpaCommonsTransfer";
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
import { computeCommonsProjectionResultDigest } from "../../app/src/lib/garpa/commonsSeededSubstitutionDigest";
import {
  computeCommonsSeededSubstitutionResultDigest,
  computeTargetSubstitutionPlanDigest,
} from "../../app/src/lib/garpa/commonsSeededArchitectureDigest";
import { runCommonsTransferGate } from "../../app/src/lib/garpa/runCommonsTransferGate";
import { runCommonsComponentProjectionGate } from "../../app/src/lib/garpa/runCommonsComponentProjectionGate";
import { runCommonsSeededSubstitutionGate } from "../../app/src/lib/garpa/runCommonsSeededSubstitutionGate";
import { runCommonsSeededArchitectureGate } from "../../app/src/lib/garpa/runCommonsSeededArchitectureGate";
import { validateCommonsSeededArchitectureRequest } from "../../app/src/lib/garpa/validateCommonsSeededArchitecture";
import { renderCommonsSeededArchitectureMarkdown } from "../../app/src/lib/garpa/renderCommonsSeededArchitecture";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const TARGET_ENVIRONMENT = {
  location: "controlled indoor fixture",
  lighting: "constant",
  background: "static",
  target_class: "synthetic-known-object-v1",
};

function initialCatalog(): CommonsCatalog {
  const catalog = clone(emptyCatalogRaw) as unknown as CommonsCatalog;
  const update: CommonsCatalogUpdateRequest = {
    schemaVersion: 1,
    currentCatalog: catalog,
    expectedCatalogDigest: catalog.catalogDigest,
    admissionRequest: clone(admissionRequestRaw) as unknown as CommonsAdmissionRequest,
    admissionResult: clone(admissionResultRaw) as unknown as CommonsAdmissionResult,
    operations: clone(operationsRaw) as unknown as CommonsCatalogOperation[],
    actor: "GARPA seeded architecture fixture",
    updatedAt: "2026-08-23T05:30:00Z",
  };
  const result = applyCommonsCatalogUpdate(update);
  expect(result.gate.passed, JSON.stringify(result.gate.findings)).toBe(true);
  return result.catalog!;
}

function targetGraph(): CapabilityGraph {
  return clone(targetGraphRaw) as unknown as CapabilityGraph;
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

function transferRequest(): CommonsTransferRequest {
  const catalog = initialCatalog();
  const graph = targetGraph();
  const receipt = graphReceipt(graph);
  const graphDigest = computeCapabilityGraphDigest(graph);
  const retrieval = buildCommonsRetrievalPlan({
    catalog,
    expectedCatalogDigest: catalog.catalogDigest,
    targetCapabilityGraph: graph,
    targetCapabilityGraphDigest: graphDigest,
    targetGraphAdmissionReceipt: receipt,
  });
  expect(retrieval.passed, retrieval.errors.join("; ")).toBe(true);
  return {
    schemaVersion: 1,
    catalog,
    expectedCatalogDigest: catalog.catalogDigest,
    targetCapabilityGraph: graph,
    targetCapabilityGraphDigest: graphDigest,
    targetGraphAdmissionReceipt: receipt,
    retrievalPlan: retrieval.plan!,
    targetEnvironment: TARGET_ENVIRONMENT,
    targetExecutionClass: "E2_bench_passive",
    allowHistoricalResearch: false,
    nominations: [componentNomination(catalog)],
    createdAt: "2026-08-23T19:15:00Z",
  };
}

function projectionRequest(): CommonsComponentProjectionRequest {
  const transfer = transferRequest();
  const transferResult = runCommonsTransferGate(transfer);
  expect(transferResult.candidateInputNominationIds).toEqual([
    "nominate-component-sensor-v1",
  ]);
  return {
    schemaVersion: 1,
    transferRequest: transfer,
    expectedTransferResultDigest: computeCommonsTransferResultDigest(
      transferResult,
    ),
    targetClaimPacket: clone(targetPacketRaw) as unknown as ClaimPacket,
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

function seededSubstitutionRequest(): CommonsSeededSubstitutionRequest {
  const projection = projectionRequest();
  const projectionResult = runCommonsComponentProjectionGate(projection);
  expect(projectionResult.passed, JSON.stringify(projectionResult.findings)).toBe(
    true,
  );
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

function architectureRequest(): CommonsSeededArchitectureRequest {
  const seeded = seededSubstitutionRequest();
  const seededResult = runCommonsSeededSubstitutionGate(seeded);
  expect(seededResult.passed, JSON.stringify(seededResult)).toBe(true);
  const architecture = clone(architectureRaw) as unknown as CandidateArchitecture;
  architecture.capabilityGraphDigest =
    seeded.projectionRequest.transferRequest.targetCapabilityGraphDigest;
  architecture.substitutionPlanDigest = computeTargetSubstitutionPlanDigest(
    seeded.plan,
  );
  architecture.missionOutcomeDigest =
    seeded.projectionRequest.transferRequest.targetCapabilityGraph
      .missionOutcomeDigest;
  return {
    schemaVersion: 1,
    seededSubstitutionRequest: seeded,
    expectedSeededSubstitutionResultDigest:
      computeCommonsSeededSubstitutionResultDigest(seededResult),
    architecture,
    assembledAt: "2026-08-23T19:50:00Z",
  };
}

describe("GARPA Commons-seeded architecture", () => {
  it("preserves seed custody and reaches the existing architecture gate", () => {
    const request = architectureRequest();
    const validated = validateCommonsSeededArchitectureRequest(request);
    expect(validated.ok, validated.errors.join("; ")).toBe(true);
    const result = runCommonsSeededArchitectureGate(validated.value!);
    expect(result.passed, JSON.stringify(result)).toBe(true);
    expect(result.state).toBe("seeded_architecture_admitted");
    expect(result.architectureGate?.state).toBe("admitted_for_qualification");
    expect(result.seededComponentIds).toEqual(["component-sensor-v1-target"]);
    expect(result.selectedSeededComponentIds).toEqual([
      "component-sensor-v1-target",
    ]);
  });

  it("blocks a forged seeded-substitution result digest", () => {
    const request = architectureRequest();
    request.expectedSeededSubstitutionResultDigest = "a".repeat(64);
    const result = runCommonsSeededArchitectureGate(request);
    expect(result.state).toBe("seeded_architecture_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_substitution_result_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks omission of a seeded component selection", () => {
    const request = architectureRequest();
    request.architecture.componentSelections =
      request.architecture.componentSelections.filter(
        (selection) => selection.componentId !== "component-sensor-v1-target",
      );
    const result = runCommonsSeededArchitectureGate(request);
    expect(result.state).toBe("seeded_architecture_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_component_selection_missing",
      ),
    ).toBe(true);
  });

  it("blocks remapping of a seeded component", () => {
    const request = architectureRequest();
    request.architecture.componentSelections[0]!.functionIds.push(
      "f-detect-target",
    );
    const result = runCommonsSeededArchitectureGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_component_mapping_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks version or firmware drift in architecture configuration", () => {
    const request = architectureRequest();
    request.architecture.componentSelections[0]!.configuration.exactModelOrVersion =
      "sensor-v2";
    const result = runCommonsSeededArchitectureGate(request);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "seeded_component_configuration_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks an architecture bound to a different plan digest", () => {
    const request = architectureRequest();
    request.architecture.substitutionPlanDigest = "b".repeat(64);
    const result = runCommonsSeededArchitectureGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "substitution_plan_digest_mismatch",
      ),
    ).toBe(true);
  });

  it("returns incomplete when the existing architecture cost gate fails", () => {
    const request = architectureRequest();
    request.architecture.costEnvelope.lines =
      request.architecture.costEnvelope.lines.filter(
        (line) => line.category !== "contingency",
      );
    const result = runCommonsSeededArchitectureGate(request);
    expect(result.state).toBe("seeded_architecture_incomplete");
    expect(result.architectureGate?.state).toBe("cost_envelope_incomplete");
  });

  it("returns incomplete for an uncontrolled mission-failure risk", () => {
    const request = architectureRequest();
    const risk = request.architecture.risks.find(
      (item) => item.id === "risk-target-detection",
    )!;
    risk.closureState = "open";
    risk.qualificationTestIds = [];
    const result = runCommonsSeededArchitectureGate(request);
    expect(result.state).toBe("seeded_architecture_incomplete");
    expect(result.architectureGate?.state).toBe(
      "high_consequence_risk_uncontrolled",
    );
  });

  it("returns incomplete when a seeded residual disappears", () => {
    const request = architectureRequest();
    request.architecture.residuals = request.architecture.residuals.filter(
      (residual) =>
        !residual.sourceComponentIds.includes("component-sensor-v1-target"),
    );
    const result = runCommonsSeededArchitectureGate(request);
    expect(result.state).toBe("seeded_architecture_incomplete");
    expect(result.architectureGate?.state).toBe(
      "residual_register_incomplete",
    );
  });

  it("keeps the architecture in candidate state before qualification", () => {
    const request = architectureRequest();
    request.architecture.state = "integration_ready";
    const result = runCommonsSeededArchitectureGate(request);
    expect(result.state).toBe("seeded_architecture_incomplete");
    expect(result.architectureGate?.state).toBe("state_transition_invalid");
  });

  it("renders exact seed custody and the qualification boundary", () => {
    const request = architectureRequest();
    const result = runCommonsSeededArchitectureGate(request);
    const markdown = renderCommonsSeededArchitectureMarkdown(request, result);
    expect(markdown).toContain("# GARPA Commons-Seeded Architecture");
    expect(markdown).toContain("component-sensor-v1-target");
    expect(markdown).toContain("admitted_for_qualification");
    expect(markdown).toContain("does not transfer source qualification");
  });
});
