import { describe, expect, it } from "vitest";
import admissionRequestRaw from "../../examples/garpa-commons/commons-request.json";
import admissionResultRaw from "../../examples/garpa-commons/commons-result.json";
import emptyCatalogRaw from "../../examples/garpa-commons-catalog/empty-catalog.json";
import operationsRaw from "../../examples/garpa-commons-catalog/operations.json";
import targetGraphRaw from "../../examples/garpa-commons-transfer/target-capability-graph.json";
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
import { applyCommonsCatalogUpdate } from "../../app/src/lib/garpa/applyCommonsCatalogUpdate";
import { computeCommonsCatalogDigest } from "../../app/src/lib/garpa/commonsCatalogDigest";
import {
  buildCommonsRetrievalPlan,
  executeCommonsRetrievalPlan,
} from "../../app/src/lib/garpa/buildCommonsRetrievalPlan";
import {
  computeCapabilityGraphDigest,
  computeCommonsRetrievalPlanDigest,
  computeGraphAdmissionReceiptDigest,
} from "../../app/src/lib/garpa/commonsCaseTransferDigest";
import {
  validateCommonsRetrievalPlan,
  validateCommonsTransferRequest,
} from "../../app/src/lib/garpa/validateCommonsTransfer";
import { runCommonsTransferGate } from "../../app/src/lib/garpa/runCommonsTransferGate";
import {
  renderCommonsRetrievalExecutionMarkdown,
  renderCommonsRetrievalPlanMarkdown,
  renderCommonsTransferMarkdown,
} from "../../app/src/lib/garpa/renderCommonsTransfer";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const TARGET_ENVIRONMENT = {
  location: "controlled indoor fixture",
  lighting: "constant",
  background: "static",
  target_class: "synthetic-known-object-v1",
};

function targetGraph(): CapabilityGraph {
  return clone(targetGraphRaw) as unknown as CapabilityGraph;
}

function initialCatalog(): CommonsCatalog {
  const catalog = clone(emptyCatalogRaw) as unknown as CommonsCatalog;
  const request: CommonsCatalogUpdateRequest = {
    schemaVersion: 1,
    currentCatalog: catalog,
    expectedCatalogDigest: catalog.catalogDigest,
    admissionRequest: clone(admissionRequestRaw) as unknown as CommonsAdmissionRequest,
    admissionResult: clone(admissionResultRaw) as unknown as CommonsAdmissionResult,
    operations: clone(operationsRaw) as unknown as CommonsCatalogOperation[],
    actor: "GARPA commons transfer fixture",
    updatedAt: "2026-08-23T05:30:00Z",
  };
  const result = applyCommonsCatalogUpdate(request);
  expect(result.gate.passed, JSON.stringify(result.gate.findings)).toBe(true);
  expect(result.catalog).toBeDefined();
  return result.catalog!;
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

function nominations(catalog: CommonsCatalog): CommonsTransferNomination[] {
  const source = sourceObjects(catalog);
  return [
    {
      nominationId: "nominate-primitive-detect-notify",
      objectType: "primitive",
      catalogObjectId: catalog.primitiveEntries[0]!.catalogObjectId,
      revisionId: source.primitiveRevision.revisionId,
      objectDigest: source.primitiveRevision.objectDigest,
      retrievalTaskIds: [
        "function:f-detect-target",
        "function:f-present-target",
        "interface:i-observation-target",
        "interface:i-detection-target",
        "interface:i-alert-target",
      ],
      requestedUse: "capability_decomposition_hint",
      targetFunctionIds: ["f-detect-target", "f-present-target"],
      targetInterfaceIds: [
        "i-observation-target",
        "i-detection-target",
        "i-alert-target",
      ],
      mappingRationale:
        "The prior primitive can inform decomposition of detection and operator notification while preserving the target graph as authoritative.",
      declaredEnvironmentComparison: "unknown",
      declaredExecutionComparison: "source_same_or_stronger",
      knownMismatches: [
        "The primitive has no structured environment record that can establish target-context equivalence.",
      ],
      acknowledgedResiduals: [...source.primitive.residuals],
      acknowledgedLimitations: source.primitive.qualificationRefs.flatMap(
        (item) => item.limitations,
      ),
      acknowledgedFalsificationConditions: [
        ...source.primitive.falsificationConditions,
      ],
      acknowledgedFailureModes: [],
      requiredEvidencePulls: [
        "Retrieve target-case evidence that detection and operator notification are required under the admitted mission boundary.",
      ],
      requiredQualificationTests: [],
    },
    {
      nominationId: "nominate-component-sensor-v1",
      objectType: "component_observation",
      catalogObjectId:
        catalog.componentObservationEntries[0]!.catalogObjectId,
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
        "The exact-version local observation is a target-case retrieval lead for the passive observation function under the same synthetic fixture envelope.",
      declaredEnvironmentComparison: "same",
      declaredExecutionComparison: "source_same_or_stronger",
      knownMismatches: [],
      acknowledgedResiduals: [...source.component.residuals],
      acknowledgedLimitations: [...source.component.limitations],
      acknowledgedFalsificationConditions: [],
      acknowledgedFailureModes: [],
      requiredEvidencePulls: [
        "Recover current availability, license, security, price, and exact-version identity evidence for sensor-v1 in the target case.",
      ],
      requiredQualificationTests: [
        "Re-run the target observation fixture and interface tests against the target graph and configuration.",
      ],
    },
    {
      nominationId: "nominate-pattern-observe-detect-present",
      objectType: "architecture_pattern",
      catalogObjectId: catalog.architecturePatternEntries[0]!.catalogObjectId,
      revisionId: source.patternRevision.revisionId,
      objectDigest: source.patternRevision.objectDigest,
      retrievalTaskIds: [
        "function:f-observe-target",
        "function:f-detect-target",
        "function:f-present-target",
        "interface:i-world-target",
        "interface:i-observation-target",
        "interface:i-detection-target",
        "interface:i-alert-target",
      ],
      requestedUse: "architecture_pattern_hint",
      targetFunctionIds: [
        "f-observe-target",
        "f-detect-target",
        "f-present-target",
      ],
      targetInterfaceIds: [
        "i-world-target",
        "i-observation-target",
        "i-detection-target",
        "i-alert-target",
      ],
      mappingRationale:
        "The pattern can inform candidate composition order while target-case compatibility, configuration, and architecture remain unassessed.",
      declaredEnvironmentComparison: "unknown",
      declaredExecutionComparison: "source_same_or_stronger",
      knownMismatches: [
        "The architecture pattern has no structured environment record that can establish transfer equivalence.",
      ],
      acknowledgedResiduals: [...source.pattern.residuals],
      acknowledgedLimitations: source.pattern.qualificationRefs.flatMap(
        (item) => item.limitations,
      ),
      acknowledgedFalsificationConditions: [],
      acknowledgedFailureModes: [...source.pattern.failureModes],
      requiredEvidencePulls: [
        "Retrieve target-case component, interface, operator, dependency, and cost evidence before proposing an architecture.",
      ],
      requiredQualificationTests: [
        "Qualify every selected target-case interface and end-to-end function chain under the frozen target fixture.",
      ],
    },
  ];
}

function transferRequest(catalog = initialCatalog()): CommonsTransferRequest {
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
    nominations: nominations(catalog),
    createdAt: "2026-08-23T17:30:00Z",
  };
}

function historicalPrimitiveCatalog(
  state: "superseded" | "withdrawn",
): CommonsCatalog {
  const catalog = initialCatalog();
  const entry = catalog.primitiveEntries[0]!;
  entry.revisions[0]!.state = state;
  entry.currentRevisionId = undefined;
  catalog.revision += 1;
  catalog.updatedAt = "2026-08-23T17:20:00Z";
  catalog.catalogDigest = computeCommonsCatalogDigest(catalog);
  return catalog;
}

describe("GARPA commons retrieval plan", () => {
  it("builds a deterministic function and interface retrieval plan", () => {
    const request = transferRequest();
    expect(request.retrievalPlan.tasks).toHaveLength(7);
    expect(request.retrievalPlan.tasks.map((task) => task.taskId)).toContain(
      "function:f-observe-target",
    );
    expect(validateCommonsRetrievalPlan(request.retrievalPlan).ok).toBe(true);
    const { planDigest: _digest, ...content } = request.retrievalPlan;
    expect(computeCommonsRetrievalPlanDigest(content)).toBe(
      request.retrievalPlan.planDigest,
    );
  });

  it("executes OR-style term queries and returns exact source context", () => {
    const request = transferRequest();
    const result = executeCommonsRetrievalPlan(
      request.catalog,
      request.retrievalPlan,
    );
    expect(result.passed, result.errors.join("; ")).toBe(true);
    expect(result.candidateHits.length).toBeGreaterThan(0);
    expect(
      result.candidateHits.some(
        (hit) => hit.objectType === "component_observation",
      ),
    ).toBe(true);
    expect(
      result.candidateHits.every(
        (hit) =>
          hit.objectDigest.length === 64 &&
          hit.sourceReleaseDigest.length === 64,
      ),
    ).toBe(true);
    expect(result.candidateHits[0]).not.toHaveProperty("score");
  });
});

describe("GARPA commons transfer validation and gate", () => {
  it("validates and admits three source-bound nominations", () => {
    const request = transferRequest();
    const validated = validateCommonsTransferRequest(request);
    expect(validated.ok, validated.errors.join("; ")).toBe(true);
    const result = runCommonsTransferGate(validated.value!);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.state).toBe("transfer_admitted");
    expect(result.admittedNominationIds).toHaveLength(3);
    expect(result.candidateInputNominationIds).toEqual([
      "nominate-component-sensor-v1",
    ]);
    expect(result.researchLeadNominationIds).toEqual([
      "nominate-primitive-detect-notify",
      "nominate-pattern-observe-detect-present",
    ]);
  });

  it("blocks a stale catalog digest globally", () => {
    const request = transferRequest();
    request.expectedCatalogDigest = "a".repeat(64);
    const result = runCommonsTransferGate(request);
    expect(result.state).toBe("transfer_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "catalog_digest_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks a target graph that is not admitted for substitution", () => {
    const request = transferRequest();
    const content = {
      ...request.targetGraphAdmissionReceipt,
      passed: false,
      state: "essential_function_unresolved" as const,
    };
    const { receiptDigest: _old, ...withoutDigest } = content;
    request.targetGraphAdmissionReceipt = {
      ...withoutDigest,
      receiptDigest: computeGraphAdmissionReceiptDigest(withoutDigest),
    };
    const result = runCommonsTransferGate(request);
    expect(result.state).toBe("transfer_blocked");
    expect(
      result.findings.some((finding) => finding.state === "graph_not_admitted"),
    ).toBe(true);
  });

  it("blocks a retrieval plan that was rewritten after generation", () => {
    const request = transferRequest();
    request.retrievalPlan.tasks[0]!.targetLabel = "Rewritten target";
    const { planDigest: _old, ...content } = request.retrievalPlan;
    request.retrievalPlan.planDigest = computeCommonsRetrievalPlanDigest(content);
    const result = runCommonsTransferGate(request);
    expect(result.state).toBe("transfer_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "retrieval_plan_mismatch",
      ),
    ).toBe(true);
  });

  it("partially admits valid nominations while blocking a forged object digest", () => {
    const request = transferRequest();
    request.nominations[1]!.objectDigest = "b".repeat(64);
    const result = runCommonsTransferGate(request);
    expect(result.state).toBe("transfer_partially_admitted");
    expect(result.admittedNominationIds).toHaveLength(2);
    expect(result.blockedNominationIds).toEqual([
      "nominate-component-sensor-v1",
    ]);
  });

  it("blocks superseded revisions unless historical research is explicit", () => {
    const catalog = historicalPrimitiveCatalog("superseded");
    const request = transferRequest(catalog);
    request.nominations = [request.nominations[0]!];
    let result = runCommonsTransferGate(request);
    expect(result.state).toBe("transfer_blocked");
    expect(
      result.findings.some(
        (finding) => finding.state === "historical_revision_not_permitted",
      ),
    ).toBe(true);

    request.allowHistoricalResearch = true;
    result = runCommonsTransferGate(request);
    expect(result.passed).toBe(true);
    expect(result.researchLeadNominationIds).toEqual([
      "nominate-primitive-detect-notify",
    ]);
    expect(result.candidateInputNominationIds).toEqual([]);
  });

  it("never transfers a withdrawn revision", () => {
    const catalog = historicalPrimitiveCatalog("withdrawn");
    const request = transferRequest(catalog);
    request.nominations = [request.nominations[0]!];
    request.allowHistoricalResearch = true;
    const result = runCommonsTransferGate(request);
    expect(result.state).toBe("transfer_blocked");
    expect(
      result.findings.some((finding) => finding.state === "withdrawn_revision"),
    ).toBe(true);
  });

  it("blocks an object used as the wrong transfer class", () => {
    const request = transferRequest();
    request.nominations[0]!.requestedUse = "component_retrieval_lead";
    const result = runCommonsTransferGate(request);
    expect(result.blockedNominationIds).toContain(
      "nominate-primitive-detect-notify",
    );
    expect(
      result.findings.some(
        (finding) => finding.state === "transfer_use_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks omitted source residuals and pattern failure modes", () => {
    const request = transferRequest();
    request.nominations[0]!.acknowledgedResiduals = [];
    request.nominations[2]!.acknowledgedFailureModes = [];
    const result = runCommonsTransferGate(request);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "residual_acknowledgement_incomplete",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) =>
          finding.state === "failure_mode_acknowledgement_incomplete",
      ),
    ).toBe(true);
  });

  it("blocks forged environment and execution comparisons", () => {
    const request = transferRequest();
    request.nominations[1]!.declaredEnvironmentComparison = "different";
    request.nominations[1]!.declaredExecutionComparison =
      "target_more_demanding";
    const result = runCommonsTransferGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "environment_comparison_mismatch",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "execution_comparison_mismatch",
      ),
    ).toBe(true);
  });

  it("blocks mappings to absent target functions and interfaces", () => {
    const request = transferRequest();
    request.nominations[1]!.targetFunctionIds = ["f-ghost"];
    request.nominations[1]!.targetInterfaceIds = ["i-ghost"];
    const result = runCommonsTransferGate(request);
    expect(
      result.findings.some(
        (finding) => finding.state === "target_function_invalid",
      ),
    ).toBe(true);
    expect(
      result.findings.some(
        (finding) => finding.state === "target_interface_invalid",
      ),
    ).toBe(true);
  });

  it("requires target evidence and qualification before component transfer", () => {
    const request = transferRequest();
    request.nominations[1]!.requiredEvidencePulls = [];
    request.nominations[1]!.requiredQualificationTests = [];
    const validation = validateCommonsTransferRequest(request);
    expect(validation.ok).toBe(false);
    expect(validation.errors.join(" ")).toContain("requiredEvidencePulls");
  });

  it("does not emit downstream substitution or architecture state", () => {
    const result = runCommonsTransferGate(transferRequest());
    const component = result.nominations.find(
      (item) => item.nominationId === "nominate-component-sensor-v1",
    );
    expect(component?.disposition).toBe("candidate_input");
    expect(component).not.toHaveProperty("componentCandidate");
    expect(component).not.toHaveProperty("compatibilityState");
    expect(component).not.toHaveProperty("functionCoverage");
    expect(component).not.toHaveProperty("architectureSelection");
    expect(component).not.toHaveProperty("qualificationState");
    expect(result.prohibitedTransitions).toHaveLength(4);
  });
});

describe("GARPA commons transfer receipts", () => {
  it("renders retrieval and transfer boundaries", () => {
    const request = transferRequest();
    const execution = executeCommonsRetrievalPlan(
      request.catalog,
      request.retrievalPlan,
    );
    const result = runCommonsTransferGate(request);
    const planMarkdown = renderCommonsRetrievalPlanMarkdown(
      request.retrievalPlan,
    );
    const executionMarkdown = renderCommonsRetrievalExecutionMarkdown(execution);
    const transferMarkdown = renderCommonsTransferMarkdown(request, result);
    expect(planMarkdown).toContain("Prohibited transitions");
    expect(executionMarkdown).toContain("source-bound leads only");
    expect(transferMarkdown).toContain("candidate_input");
    expect(transferMarkdown).toContain("Source release digest");
    expect(transferMarkdown).toContain(
      "before any nominated lead could satisfy the existing substitution and architecture gates",
    );
  });
});
