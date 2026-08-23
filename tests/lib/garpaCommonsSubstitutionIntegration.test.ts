import { describe, expect, it } from "vitest";
import admissionRequestRaw from "../../examples/garpa-commons/commons-request.json";
import admissionResultRaw from "../../examples/garpa-commons/commons-result.json";
import emptyCatalogRaw from "../../examples/garpa-commons-catalog/empty-catalog.json";
import operationsRaw from "../../examples/garpa-commons-catalog/operations.json";
import claimPacketRaw from "../../examples/garpa-synthetic-observation/claim-packet.json";
import capabilityGraphRaw from "../../examples/garpa-synthetic-observation/capability-graph.json";
import substitutionPlanRaw from "../../examples/garpa-synthetic-observation/substitution-plan.json";
import type { ClaimPacket } from "../../app/src/types/garpa";
import type {
  CommonsAdmissionRequest,
  CommonsAdmissionResult,
} from "../../app/src/types/garpaCommons";
import type {
  CommonsCatalog,
  CommonsCatalogOperation,
  CommonsCatalogUpdateRequest,
} from "../../app/src/types/garpaCommonsCatalog";
import type {
  CommonsCompatibilityAdmissionReceiptContent,
  CommonsComponentProjectionRequest,
} from "../../app/src/types/garpaCommonsProjection";
import type { CommonsSubstitutionSeedRequest } from "../../app/src/types/garpaCommonsSubstitutionSeed";
import type {
  CapabilityGraph,
  CapabilityGraphGateResult,
} from "../../app/src/types/garpaCapability";
import type { SubstitutionPlan } from "../../app/src/types/garpaSubstitution";
import { applyCommonsCatalogUpdate } from "../../app/src/lib/garpa/applyCommonsCatalogUpdate";
import { computeCompatibilityAdmissionReceiptDigest } from "../../app/src/lib/garpa/commonsProjectionDigest";
import { runCommonsComponentProjectionGate } from "../../app/src/lib/garpa/runCommonsProjectionGate";
import { seedCommonsProjectionIntoSubstitutionPlan } from "../../app/src/lib/garpa/seedCommonsProjectionIntoSubstitutionPlan";
import { runSubstitutionGate } from "../../app/src/lib/garpa/runSubstitutionGate";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function catalog(): CommonsCatalog {
  const currentCatalog = clone(emptyCatalogRaw) as unknown as CommonsCatalog;
  const update: CommonsCatalogUpdateRequest = {
    schemaVersion: 1,
    currentCatalog,
    expectedCatalogDigest: currentCatalog.catalogDigest,
    admissionRequest: clone(admissionRequestRaw) as unknown as CommonsAdmissionRequest,
    admissionResult: clone(admissionResultRaw) as unknown as CommonsAdmissionResult,
    operations: clone(operationsRaw) as unknown as CommonsCatalogOperation[],
    actor: "GARPA substitution integration fixture",
    updatedAt: "2026-08-23T05:30:00Z",
  };
  const result = applyCommonsCatalogUpdate(update);
  expect(result.gate.passed, JSON.stringify(result.gate.findings)).toBe(true);
  return result.catalog!;
}

function graphGate(graph: CapabilityGraph): CapabilityGraphGateResult {
  return {
    state: "admitted_for_substitution",
    passed: true,
    requiredRequirementKeys: graph.traces.map((trace) => trace.requirementKey),
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

function projectionRequest(
  graph: CapabilityGraph,
  packet: ClaimPacket,
  capabilityGraphDigest: string,
): CommonsComponentProjectionRequest {
  const currentCatalog = catalog();
  const entry = currentCatalog.componentObservationEntries[0]!;
  const revision = entry.revisions.find((item) => item.state === "current")!;
  const evidenceIds = packet.evidence.slice(0, 5).map((cell) => cell.id);
  const evidence = (index: number) => evidenceIds[index] ?? evidenceIds[0]!;
  const receiptContent: CommonsCompatibilityAdmissionReceiptContent = {
    receiptId: `commons-closure:${graph.caseId}:sensor-v1`,
    targetCaseId: graph.caseId,
    targetMissionOutcomeDigest: graph.missionOutcomeDigest,
    targetCapabilityGraphDigest: capabilityGraphDigest,
    nominationId: "nominate-sensor-v1",
    disposition: "compatibility_admitted",
    catalogObjectId: entry.catalogObjectId,
    revisionId: revision.revisionId,
    objectDigest: revision.objectDigest,
    sourceCaseId: revision.sourceCaseId,
    sourceReleaseId: revision.sourceReleaseId,
    sourceReleaseDigest: revision.sourceReleaseDigest,
    targetFunctionIds: ["f-observe"],
    targetInterfaceIds: ["i-world", "i-observation"],
    targetExecutionClass: "E2_bench_passive",
    targetIdentityReceiptIds: ["identity-receipt:sensor-v1"],
    targetCompatibilityReceiptIds: [
      "compatibility-receipt:i-world",
      "compatibility-receipt:i-observation",
    ],
    targetEnvironmentReceiptIds: ["environment-receipt:controlled-fixture"],
    targetQualificationReceiptIds: ["qualification-receipt:observe-target"],
  };
  return {
    schemaVersion: 1,
    projectionId: `projection:${graph.caseId}:sensor-v1`,
    catalog: currentCatalog,
    expectedCatalogDigest: currentCatalog.catalogDigest,
    compatibilityAdmissionReceipt: {
      ...receiptContent,
      receiptDigest: computeCompatibilityAdmissionReceiptDigest(receiptContent),
    },
    targetComponentId: "commons-target-sensor-v1",
    targetEvidence: {
      targetCaseId: graph.caseId,
      componentKind: "commercial_hardware",
      identityEvidenceCellIds: [evidence(0)],
      performanceEvidenceCellIds: [evidence(1)],
      licenseEvidenceCellIds: [evidence(2)],
      operatingRequirementEvidenceCellIds: [evidence(3)],
      securityEvidenceCellIds: [evidence(4)],
      performanceEnvelope: { sample_rate: "10 Hz" },
      operatingRequirements: { power: "5 VDC" },
      license: "Target-case evaluation license",
      licenseNotApplicable: false,
      sourceAvailability: "Target supplier capture",
      securityNotes: ["Target security review complete."],
      price: {
        amount: 125,
        currency: "USD",
        capturedAt: "2026-08-23T17:00:00Z",
        evidenceCellIds: [evidence(0)],
        includedCostCategories: ["hardware"],
        excludedCostCategories: ["integration_labor"],
      },
      availability: {
        state: "in_stock",
        capturedAt: "2026-08-23T17:00:00Z",
        evidenceCellIds: [evidence(0)],
      },
      integrationRequirements: ["Run target interface tests."],
      limitations: ["Bounded target fixture."],
      residuals: ["Field performance unassessed."],
    },
    economicBoundaryRequired: true,
    createdAt: "2026-08-23T17:45:00Z",
  };
}

describe("GARPA Commons projection through the existing substitution gate", () => {
  it("inserts the candidate but remains blocked until target options, compatibility, and cost closure exist", () => {
    const packet = clone(claimPacketRaw) as unknown as ClaimPacket;
    const graph = clone(capabilityGraphRaw) as unknown as CapabilityGraph;
    const fixturePlan = clone(substitutionPlanRaw) as unknown as SubstitutionPlan;
    const projectionRequestValue = projectionRequest(
      graph,
      packet,
      fixturePlan.capabilityGraphDigest,
    );
    const projectionResult = runCommonsComponentProjectionGate(
      projectionRequestValue,
    );
    expect(projectionResult.passed, JSON.stringify(projectionResult.findings)).toBe(true);
    expect(projectionResult.readiness).toBe("substitution_ready");

    const emptyPlan: SubstitutionPlan = {
      schemaVersion: 1,
      caseId: graph.caseId,
      capabilityGraphDigest: fixturePlan.capabilityGraphDigest,
      components: [],
      customCode: [],
      compatibilityEdges: [],
      options: [],
      costBoundary: {
        state: "unresolved",
        includedCategories: [],
        excludedCategories: [],
        note: "Commons insertion cannot close the target cost boundary.",
      },
      exclusions: ["No architecture or procurement authority."],
    };
    const seedRequest: CommonsSubstitutionSeedRequest = {
      schemaVersion: 1,
      insertionId: "insert-commons-sensor-v1",
      projectionRequest: projectionRequestValue,
      projectionResult,
      targetPlan: emptyPlan,
      expectedTargetCaseId: graph.caseId,
      expectedCapabilityGraphDigest: fixturePlan.capabilityGraphDigest,
      createdAt: "2026-08-23T17:50:00Z",
    };
    const seeded = seedCommonsProjectionIntoSubstitutionPlan(seedRequest);
    expect(seeded.passed, JSON.stringify(seeded.findings)).toBe(true);
    expect(seeded.plan?.components).toHaveLength(1);
    expect(seeded.plan?.options).toEqual([]);
    expect(seeded.plan?.compatibilityEdges).toEqual([]);

    const gate = runSubstitutionGate(
      seeded.plan!,
      graph,
      graphGate(graph),
      packet,
    );
    expect(gate.passed).toBe(false);
    expect(gate.uncoveredFunctionIds.length).toBeGreaterThan(0);
    expect(gate.uncoveredInterfaceIds.length).toBeGreaterThan(0);
    expect(gate.costBoundaryFindings.length).toBeGreaterThan(0);
  });
});
