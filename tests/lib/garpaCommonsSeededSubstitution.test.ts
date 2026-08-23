import { describe, expect, it } from "vitest";
import admissionRequestRaw from "../../examples/garpa-commons/commons-request.json";
import admissionResultRaw from "../../examples/garpa-commons/commons-result.json";
import emptyCatalogRaw from "../../examples/garpa-commons-catalog/empty-catalog.json";
import operationsRaw from "../../examples/garpa-commons-catalog/operations.json";
import targetGraphRaw from "../../examples/garpa-commons-transfer/target-capability-graph.json";
import targetPacketRaw from "../../examples/garpa-synthetic-observation/claim-packet.json";
import candidateRaw from "../../examples/garpa-commons-component-projection/candidate.json";
import planRaw from "../../examples/garpa-commons-seeded-substitution/substitution-plan.json";
import type { ClaimPacket } from "../../app/src/types/garpa";
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
import type {
  CapabilityGraphAdmissionReceipt,
  CommonsTransferNomination,
  CommonsTransferRequest,
} from "../../app/src/types/garpaCommonsTransfer";
import type { CommonsComponentProjectionRequest } from "../../app/src/types/garpaCommonsProjection";
import type { CommonsSeededSubstitutionRequest } from "../../app/src/types/garpaCommonsSeededSubstitution";
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
import { runCommonsTransferGate } from "../../app/src/lib/garpa/runCommonsTransferGate";
import { runCommonsComponentProjectionGate } from "../../app/src/lib/garpa/runCommonsComponentProjectionGate";
import { runCommonsSeededSubstitutionGate } from "../../app/src/lib/garpa/runCommonsSeededSubstitutionGate";
import { validateCommonsSeededSubstitutionRequest } from "../../app/src/lib/garpa/validateCommonsSeededSubstitution";
import { renderCommonsSeededSubstitutionMarkdown } from "../../app/src/lib/garpa/renderCommonsSeededSubstitution";

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
    actor: "GARPA seeded substitution fixture",
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

function seededRequest(): CommonsSeededSubstitutionRequest {
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

describe("GARPA Commons-seeded substitution", () => {
  it("binds the exact projected component and reaches the existing substitution gate", () => {
    const request = seededRequest();
    const validated = validateCommonsSeededSubstitutionRequest(request);
    expect(validated.ok, validated.errors.join("; ")).toBe(true);
    const result = runCommonsSeededSubstitutionGate(validated.value!);
    expect(result.passed, JSON.stringify(result)).toBe(true);
    expect(result.state).toBe("seeded_substitution_admitted");
    expect(result.substitutionGate?.state).toBe("admitted_for_architecture");
    expect(result.seededComponentIds).toEqual(["component-sensor-v1-target"]);
    expect(result.targetOnlyComponentIds).toEqual([
      "component-detector-target",
      "component-ui-target",
    ]);
    expect(result).not.toHaveProperty("architecture");
  });

  it("blocks a forged component-projection result digest", () => {
    const request = seededRequest();
    request.expectedProjectionResultDigest = "a".repeat(64);
    const result = runCommonsSeededSubstitutionGate(request);
    expect(result.state).toBe("seeded_substitution_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "projection_result_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks omission of the admitted projected component", () => {
    const request = seededRequest();
    request.plan.components = request.plan.components.filter(
      (component) => component.id !== "component-sensor-v1-target",
    );
    request.plan.options = request.plan.options.filter(
      (option) => option.id !== "option-observe-target",
    );
    request.plan.compatibilityEdges = request.plan.compatibilityEdges.filter(
      (edge) => edge.id !== "compat-observation-target",
    );
    const result = runCommonsSeededSubstitutionGate(request);
    expect(result.state).toBe("seeded_substitution_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_component_missing",
      ),
    ).toBe(true);
  });

  it("blocks mutation of the projected component after admission", () => {
    const request = seededRequest();
    request.plan.components[0]!.residuals.push("Post-projection mutation");
    const result = runCommonsSeededSubstitutionGate(request);
    expect(result.state).toBe("seeded_substitution_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "seeded_component_mutated",
      ),
    ).toBe(true);
  });

  it("returns an incomplete plan when target compatibility is absent", () => {
    const request = seededRequest();
    request.plan.compatibilityEdges = request.plan.compatibilityEdges.filter(
      (edge) => edge.id !== "compat-detection-target",
    );
    const result = runCommonsSeededSubstitutionGate(request);
    expect(result.state).toBe("seeded_substitution_incomplete");
    expect(result.substitutionGate?.state).toBe(
      "interface_coverage_incomplete",
    );
    expect(result.passed).toBe(false);
  });

  it("refuses weak target-only component performance", () => {
    const request = seededRequest();
    request.plan.components.find(
      (component) => component.id === "component-detector-target",
    )!.maturity = "vendor_claimed";
    const result = runCommonsSeededSubstitutionGate(request);
    expect(result.state).toBe("seeded_substitution_incomplete");
    expect(result.substitutionGate?.state).toBe(
      "component_evidence_insufficient",
    );
  });

  it("keeps the target cost boundary under the existing gate", () => {
    const request = seededRequest();
    request.plan.costBoundary.includedCategories =
      request.plan.costBoundary.includedCategories.filter(
        (category) => category !== "qualification",
      );
    const result = runCommonsSeededSubstitutionGate(request);
    expect(result.state).toBe("seeded_substitution_incomplete");
    expect(result.substitutionGate?.state).toBe("cost_boundary_incomplete");
  });

  it("blocks a plan bound to another case or graph", () => {
    const request = seededRequest();
    request.plan.caseId = "GARPA-OTHER-CASE";
    request.plan.capabilityGraphDigest = "b".repeat(64);
    const result = runCommonsSeededSubstitutionGate(request);
    expect(result.state).toBe("seeded_substitution_blocked");
    expect(
      result.findings.some((finding) => finding.state === "plan_case_mismatch"),
    ).toBe(true);
    expect(
      result.findings.some((finding) => finding.state === "graph_digest_mismatch"),
    ).toBe(true);
  });

  it("renders the seed, target-only additions, existing gate, and refusal boundary", () => {
    const request = seededRequest();
    const result = runCommonsSeededSubstitutionGate(request);
    const markdown = renderCommonsSeededSubstitutionMarkdown(request, result);
    expect(markdown).toContain("# GARPA Commons-Seeded Substitution");
    expect(markdown).toContain("component-sensor-v1-target");
    expect(markdown).toContain("component-detector-target");
    expect(markdown).toContain("admitted_for_architecture");
    expect(markdown).toContain("cannot replace, omit, or mutate");
  });
});
