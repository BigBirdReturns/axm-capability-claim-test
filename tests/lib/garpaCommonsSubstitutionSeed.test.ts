import { describe, expect, it } from "vitest";
import type {
  CommonsComponentProjectionResult,
  ProjectedCommonsComponentCandidate,
} from "../../app/src/types/garpaCommonsProjection";
import type { CommonsSubstitutionSeedRequest } from "../../app/src/types/garpaCommonsSubstitutionSeed";
import type {
  ComponentCandidate,
  SubstitutionPlan,
} from "../../app/src/types/garpaSubstitution";
import { seedCommonsProjectionIntoSubstitutionPlan } from "../../app/src/lib/garpa/seedCommonsProjectionIntoSubstitutionPlan";

function component(): ComponentCandidate {
  return {
    id: "target-component-sensor-v1",
    kind: "commercial_hardware",
    manufacturer: "Synthetic Fixture Labs",
    product: "Synthetic Fixture Sensor",
    exactModelOrVersion: "sensor-v1",
    functionIds: ["f-observe-target"],
    interfaceIds: ["i-world-target", "i-observation-target"],
    maturity: "bench_reproduced",
    identityEvidenceCellIds: ["target-evidence:identity:sensor-v1"],
    performanceEvidenceCellIds: ["target-evidence:performance:sensor-v1"],
    licenseEvidenceCellIds: ["target-evidence:license:sensor-v1"],
    performanceEnvelope: { sample_rate: "10 Hz" },
    operatingRequirements: { power: "5 VDC" },
    license: "Target-case evaluation license",
    sourceAvailability: "Target supplier capture",
    securityNotes: ["Target security review complete."],
    price: {
      amount: 125,
      currency: "USD",
      capturedAt: "2026-08-23T17:00:00Z",
      evidenceCellIds: ["target-evidence:price:sensor-v1"],
      includedCostCategories: ["hardware"],
      excludedCostCategories: ["integration_labor"],
    },
    availability: {
      state: "in_stock",
      capturedAt: "2026-08-23T17:00:00Z",
      evidenceCellIds: ["target-evidence:availability:sensor-v1"],
    },
    integrationRequirements: ["Run target interface tests."],
    limitations: ["Bounded target fixture."],
    residuals: ["Field performance unassessed."],
    lifecycle: "available",
  };
}

function projection(
  readiness: "component_candidate" | "substitution_ready" = "substitution_ready",
): CommonsComponentProjectionResult {
  const projected: ProjectedCommonsComponentCandidate = {
    projectionId: "projection-1",
    targetCaseId: "GARPA-TARGET-PROJECTION-1",
    sourceCatalogObjectId: "component-observation:sensor-v1",
    sourceRevisionId: "component-observation:sensor-v1@1",
    sourceObjectDigest: "a".repeat(64),
    closureReceiptDigest: "b".repeat(64),
    readiness,
    component: component(),
    fieldProvenance: [],
    withheldFields: readiness === "substitution_ready" ? [] : ["performanceEnvelope"],
    requiredEvidencePulls: readiness === "substitution_ready" ? [] : ["Measure target performance."],
    prohibitedTransitions: ["Run the target substitution gate."],
  };
  return {
    passed: true,
    state: "component_projection_admitted",
    readiness,
    findings: [],
    projected,
  };
}

function plan(): SubstitutionPlan {
  return {
    schemaVersion: 1,
    caseId: "GARPA-TARGET-PROJECTION-1",
    capabilityGraphDigest: "c".repeat(64),
    components: [],
    customCode: [],
    compatibilityEdges: [],
    options: [],
    costBoundary: {
      state: "unresolved",
      includedCategories: [],
      excludedCategories: [],
      note: "Projection insertion does not complete the target cost boundary.",
    },
    exclusions: ["No architecture or procurement authority."],
  };
}

function request(
  projectionResult: CommonsComponentProjectionResult = projection(),
  targetPlan: SubstitutionPlan = plan(),
): CommonsSubstitutionSeedRequest {
  return {
    schemaVersion: 1,
    insertionId: "insert-projection-1",
    projectionResult,
    targetPlan,
    expectedTargetCaseId: "GARPA-TARGET-PROJECTION-1",
    expectedCapabilityGraphDigest: "c".repeat(64),
    createdAt: "2026-08-23T17:45:00Z",
  };
}

describe("GARPA Commons projection insertion into a target SubstitutionPlan", () => {
  it("seeds the exact projected ComponentCandidate without fabricating options or compatibility", () => {
    const result = seedCommonsProjectionIntoSubstitutionPlan(request());
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.state).toBe("substitution_plan_seeded");
    expect(result.plan?.components).toEqual([component()]);
    expect(result.plan?.options).toEqual([]);
    expect(result.plan?.compatibilityEdges).toEqual([]);
    expect(result.plan?.costBoundary.state).toBe("unresolved");
    expect(result.downstreamSubstitutionGateRequired).toBe(true);
  });

  it("refuses a component-candidate projection whose target evidence remains open", () => {
    const result = seedCommonsProjectionIntoSubstitutionPlan(
      request(projection("component_candidate")),
    );
    expect(result.passed).toBe(false);
    expect(result.state).toBe("projection_not_substitution_ready");
  });

  it("is idempotent when the exact projected component already exists", () => {
    const targetPlan = plan();
    targetPlan.components.push(component());
    const result = seedCommonsProjectionIntoSubstitutionPlan(request(projection(), targetPlan));
    expect(result.passed).toBe(true);
    expect(result.state).toBe("substitution_plan_noop");
    expect(result.plan?.components).toHaveLength(1);
  });

  it("refuses to overwrite a different target component sharing the projected id", () => {
    const targetPlan = plan();
    targetPlan.components.push({ ...component(), product: "Different Target Object" });
    const result = seedCommonsProjectionIntoSubstitutionPlan(request(projection(), targetPlan));
    expect(result.passed).toBe(false);
    expect(result.state).toBe("component_identity_conflict");
  });

  it("refuses a target case or capability-graph mismatch", () => {
    const targetPlan = plan();
    targetPlan.caseId = "OTHER-CASE";
    targetPlan.capabilityGraphDigest = "d".repeat(64);
    const result = seedCommonsProjectionIntoSubstitutionPlan(request(projection(), targetPlan));
    expect(result.passed).toBe(false);
    expect(result.findings.map((item) => item.state)).toContain("target_case_mismatch");
    expect(result.findings.map((item) => item.state)).toContain(
      "capability_graph_digest_mismatch",
    );
  });
});
