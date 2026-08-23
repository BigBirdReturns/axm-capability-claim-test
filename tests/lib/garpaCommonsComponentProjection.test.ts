import { describe, expect, it } from "vitest";
import admissionRequestRaw from "../../examples/garpa-commons/commons-request.json";
import admissionResultRaw from "../../examples/garpa-commons/commons-result.json";
import emptyCatalogRaw from "../../examples/garpa-commons-catalog/empty-catalog.json";
import operationsRaw from "../../examples/garpa-commons-catalog/operations.json";
import targetGraphRaw from "../../examples/garpa-commons-transfer/target-capability-graph.json";
import targetPacketRaw from "../../examples/garpa-synthetic-observation/claim-packet.json";
import candidateRaw from "../../examples/garpa-commons-component-projection/candidate.json";
import type { ClaimPacket } from "../../app/src/types/garpa";
import type {
  ArchitecturePattern,
  CapabilityPrimitive,
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
import type {
  CapabilityGraphAdmissionReceipt,
  CommonsTransferNomination,
  CommonsTransferRequest,
} from "../../app/src/types/garpaCommonsTransfer";
import type {
  CommonsComponentProjectionRequest,
} from "../../app/src/types/garpaCommonsProjection";
import type { ComponentCandidate } from "../../app/src/types/garpaSubstitution";
import { applyCommonsCatalogUpdate } from "../../app/src/lib/garpa/applyCommonsCatalogUpdate";
import {
  buildCommonsRetrievalPlan,
} from "../../app/src/lib/garpa/buildCommonsRetrievalPlan";
import {
  computeCapabilityGraphDigest,
  computeGraphAdmissionReceiptDigest,
} from "../../app/src/lib/garpa/commonsCaseTransferDigest";
import { computeCommonsTransferResultDigest } from "../../app/src/lib/garpa/commonsComponentProjectionDigest";
import { runCommonsTransferGate } from "../../app/src/lib/garpa/runCommonsTransferGate";
import { runCommonsComponentProjectionGate } from "../../app/src/lib/garpa/runCommonsComponentProjectionGate";
import { validateCommonsComponentProjectionRequest } from "../../app/src/lib/garpa/validateCommonsComponentProjection";
import { renderCommonsComponentProjectionMarkdown } from "../../app/src/lib/garpa/renderCommonsComponentProjection";

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
  const request: CommonsCatalogUpdateRequest = {
    schemaVersion: 1,
    currentCatalog: catalog,
    expectedCatalogDigest: catalog.catalogDigest,
    admissionRequest: clone(admissionRequestRaw) as unknown as CommonsAdmissionRequest,
    admissionResult: clone(admissionResultRaw) as unknown as CommonsAdmissionResult,
    operations: clone(operationsRaw) as unknown as CommonsCatalogOperation[],
    actor: "GARPA component projection fixture",
    updatedAt: "2026-08-23T05:30:00Z",
  };
  const result = applyCommonsCatalogUpdate(request);
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

function sourceObjects(catalog: CommonsCatalog): {
  primitive: CapabilityPrimitive;
  component: ComponentObservation;
  pattern: ArchitecturePattern;
  primitiveRevision: CommonsCatalog["primitiveEntries"][number]["revisions"][number];
  componentRevision: CommonsCatalog["componentObservationEntries"][number]["revisions"][number];
  patternRevision: CommonsCatalog["architecturePatternEntries"][number]["revisions"][number];
} {
  const primitiveRevision = catalog.primitiveEntries[0]!.revisions[0]!;
  const componentRevision = catalog.componentObservationEntries[0]!.revisions[0]!;
  const patternRevision = catalog.architecturePatternEntries[0]!.revisions[0]!;
  return {
    primitive: primitiveRevision.value,
    component: componentRevision.value,
    pattern: patternRevision.value,
    primitiveRevision,
    componentRevision,
    patternRevision,
  };
}

function componentNomination(catalog: CommonsCatalog): CommonsTransferNomination {
  const source = sourceObjects(catalog);
  return {
    nominationId: "nominate-component-sensor-v1",
    objectType: "component_observation",
    catalogObjectId: catalog.componentObservationEntries[0]!.catalogObjectId,
    revisionId: source.componentRevision.revisionId,
    objectDigest: source.componentRevision.objectDigest,
    retrievalTaskIds: [
      "function:f-observe-target",
      "interface:i-world-target",
      "interface:i-observation-target",
    ],
    requestedUse: "component_retrieval_lead",
    targetFunctionIds: ["f-observe-target"],
    targetInterfaceIds: ["i-world-target", "i-observation-target"],
    mappingRationale:
      "The exact-version source observation nominates sensor-v1 for target-case evidence retrieval only.",
    declaredEnvironmentComparison: "same",
    declaredExecutionComparison: "source_same_or_stronger",
    knownMismatches: [],
    acknowledgedResiduals: [...source.component.residuals],
    acknowledgedLimitations: [...source.component.limitations],
    acknowledgedFalsificationConditions: [],
    acknowledgedFailureModes: [],
    requiredEvidencePulls: [
      "Recover current target-case identity, performance, availability, price, and security evidence for sensor-v1.",
    ],
    requiredQualificationTests: [
      "Re-run the target observation fixture and interface tests against the target graph and configuration.",
    ],
  };
}

function primitiveNomination(catalog: CommonsCatalog): CommonsTransferNomination {
  const source = sourceObjects(catalog);
  return {
    nominationId: "nominate-primitive-detect-notify",
    objectType: "primitive",
    catalogObjectId: catalog.primitiveEntries[0]!.catalogObjectId,
    revisionId: source.primitiveRevision.revisionId,
    objectDigest: source.primitiveRevision.objectDigest,
    retrievalTaskIds: ["function:f-detect-target", "function:f-present-target"],
    requestedUse: "capability_decomposition_hint",
    targetFunctionIds: ["f-detect-target", "f-present-target"],
    targetInterfaceIds: ["i-detection-target", "i-alert-target"],
    mappingRationale: "The primitive is retained as decomposition context only.",
    declaredEnvironmentComparison: "unknown",
    declaredExecutionComparison: "source_same_or_stronger",
    knownMismatches: ["No structured target-environment equivalence is claimed."],
    acknowledgedResiduals: [...source.primitive.residuals],
    acknowledgedLimitations: source.primitive.qualificationRefs.flatMap(
      (item) => item.limitations,
    ),
    acknowledgedFalsificationConditions: [
      ...source.primitive.falsificationConditions,
    ],
    acknowledgedFailureModes: [],
    requiredEvidencePulls: [
      "Retrieve target-case evidence for detection and operator notification requirements.",
    ],
    requiredQualificationTests: [],
  };
}

function transferRequest(
  nominations: CommonsTransferNomination[] = [],
): CommonsTransferRequest {
  const catalog = initialCatalog();
  const graph = targetGraph();
  const receipt = graphReceipt(graph);
  const graphDigest = computeCapabilityGraphDigest(graph);
  const plan = buildCommonsRetrievalPlan({
    catalog,
    expectedCatalogDigest: catalog.catalogDigest,
    targetCapabilityGraph: graph,
    targetCapabilityGraphDigest: graphDigest,
    targetGraphAdmissionReceipt: receipt,
  });
  expect(plan.passed, plan.errors.join("; ")).toBe(true);
  return {
    schemaVersion: 1,
    catalog,
    expectedCatalogDigest: catalog.catalogDigest,
    targetCapabilityGraph: graph,
    targetCapabilityGraphDigest: graphDigest,
    targetGraphAdmissionReceipt: receipt,
    retrievalPlan: plan.plan!,
    targetEnvironment: TARGET_ENVIRONMENT,
    targetExecutionClass: "E2_bench_passive",
    allowHistoricalResearch: false,
    nominations: nominations.length > 0 ? nominations : [componentNomination(catalog)],
    createdAt: "2026-08-23T19:15:00Z",
  };
}

function candidate(): ComponentCandidate {
  return clone(candidateRaw) as unknown as ComponentCandidate;
}

function projectionRequest(
  transfer = transferRequest(),
): CommonsComponentProjectionRequest {
  const transferResult = runCommonsTransferGate(transfer);
  expect(transferResult.candidateInputNominationIds).toContain(
    "nominate-component-sensor-v1",
  );
  return {
    schemaVersion: 1,
    transferRequest: transfer,
    expectedTransferResultDigest: computeCommonsTransferResultDigest(transferResult),
    targetClaimPacket: clone(targetPacketRaw) as unknown as ClaimPacket,
    projections: [
      {
        projectionId: "project-sensor-v1-target",
        nominationId: "nominate-component-sensor-v1",
        candidate: candidate(),
      },
    ],
    projectedAt: "2026-08-23T19:20:00Z",
  };
}

describe("GARPA Commons component projection", () => {
  it("validates and projects a target-evidenced exact-version candidate", () => {
    const request = projectionRequest();
    const validated = validateCommonsComponentProjectionRequest(request);
    expect(validated.ok, validated.errors.join("; ")).toBe(true);
    const result = runCommonsComponentProjectionGate(validated.value!);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.state).toBe("projection_admitted");
    expect(result.admittedProjectionIds).toEqual(["project-sensor-v1-target"]);
    expect(result.seed?.componentCandidateIds).toEqual([
      "component-sensor-v1-target",
    ]);
    expect(result.seed?.mappedFunctionIds).toEqual(["f-observe-target"]);
    expect(result.seed?.unmappedRequiredFunctionIds).toEqual([
      "f-detect-target",
      "f-present-target",
    ]);
    expect(result.seed).not.toHaveProperty("options");
    expect(result.seed).not.toHaveProperty("compatibilityEdges");
  });

  it("blocks a forged transfer-result digest", () => {
    const request = projectionRequest();
    request.expectedTransferResultDigest = "a".repeat(64);
    const result = runCommonsComponentProjectionGate(request);
    expect(result.state).toBe("projection_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "transfer_result_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a changed source identity", () => {
    const request = projectionRequest();
    request.projections[0]!.candidate.exactModelOrVersion = "sensor-v2";
    request.projections[0]!.candidate.identityEvidenceCellIds = ["e-sensor-id"];
    const result = runCommonsComponentProjectionGate(request);
    expect(result.blockedProjectionIds).toContain("project-sensor-v1-target");
    expect(
      result.findings.some(
        (finding) => finding.state === "candidate_identity_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks target mappings that exceed the admitted nomination", () => {
    const request = projectionRequest();
    request.projections[0]!.candidate.functionIds.push("f-detect-target");
    const result = runCommonsComponentProjectionGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "target_mapping_mismatch",
      ),
    ).toBe(true);
  });

  it("does not transfer source qualification into target maturity", () => {
    const request = projectionRequest();
    request.projections[0]!.candidate.maturity = "locally_qualified";
    const result = runCommonsComponentProjectionGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "target_performance_unearned",
      ),
    ).toBe(true);
  });

  it("requires target-case price and availability evidence for the exact version", () => {
    const request = projectionRequest();
    request.projections[0]!.candidate.price!.evidenceCellIds = [
      "e-detector-price",
    ];
    request.projections[0]!.candidate.availability!.evidenceCellIds = [
      "e-detector-availability",
    ];
    const result = runCommonsComponentProjectionGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "target_price_unresolved",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "target_availability_unresolved",
      ),
    ).toBe(true);
  });

  it("requires every source residual, limitation, firmware boundary, and requalification test", () => {
    const request = projectionRequest();
    request.projections[0]!.candidate.residuals = [];
    request.projections[0]!.candidate.limitations = [];
    request.projections[0]!.candidate.integrationRequirements = [];
    request.projections[0]!.candidate.operatingRequirements = {};
    const result = runCommonsComponentProjectionGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "source_boundary_not_carried",
      ),
    ).toBe(true);
  });

  it("partially projects valid components while refusing research-only primitives", () => {
    const catalog = initialCatalog();
    const transfer = transferRequest([
      componentNomination(catalog),
      primitiveNomination(catalog),
    ]);
    const request = projectionRequest(transfer);
    request.projections.push({
      projectionId: "project-primitive-as-component",
      nominationId: "nominate-primitive-detect-notify",
      candidate: {
        ...candidate(),
        id: "component-invalid-primitive-projection",
        functionIds: ["f-detect-target", "f-present-target"],
        interfaceIds: ["i-detection-target", "i-alert-target"],
      },
    });
    const result = runCommonsComponentProjectionGate(request);
    expect(result.state).toBe("projection_partially_admitted");
    expect(result.admittedProjectionIds).toEqual(["project-sensor-v1-target"]);
    expect(result.blockedProjectionIds).toEqual([
      "project-primitive-as-component",
    ]);
    expect(
      result.findings.some(
        (finding) => finding.state === "nomination_not_candidate_input",
      ),
    ).toBe(true);
  });

  it("renders the source, target, seed, and prohibited-transition boundary", () => {
    const request = projectionRequest();
    const result = runCommonsComponentProjectionGate(request);
    const markdown = renderCommonsComponentProjectionMarkdown(request, result);
    expect(markdown).toContain("# GARPA Commons Component Projection");
    expect(markdown).toContain("component-sensor-v1-target");
    expect(markdown).toContain("Compatibility still required");
    expect(markdown).toContain("cannot inherit source-case performance");
  });
});
