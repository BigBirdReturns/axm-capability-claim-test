import { describe, expect, it } from "vitest";
import admissionRequestRaw from "../../examples/garpa-commons/commons-request.json";
import admissionResultRaw from "../../examples/garpa-commons/commons-result.json";
import emptyCatalogRaw from "../../examples/garpa-commons-catalog/empty-catalog.json";
import operationsRaw from "../../examples/garpa-commons-catalog/operations.json";
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
import { applyCommonsCatalogUpdate } from "../../app/src/lib/garpa/applyCommonsCatalogUpdate";
import { computeCommonsCatalogDigest } from "../../app/src/lib/garpa/commonsCatalogDigest";
import { computeCompatibilityAdmissionReceiptDigest } from "../../app/src/lib/garpa/commonsProjectionDigest";
import { validateCommonsComponentProjectionRequest } from "../../app/src/lib/garpa/validateCommonsProjection";
import { runCommonsComponentProjectionGate } from "../../app/src/lib/garpa/runCommonsProjectionGate";
import { renderCommonsComponentProjectionMarkdown } from "../../app/src/lib/garpa/renderCommonsProjection";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function catalog(): CommonsCatalog {
  const currentCatalog = clone(emptyCatalogRaw) as unknown as CommonsCatalog;
  const request: CommonsCatalogUpdateRequest = {
    schemaVersion: 1,
    currentCatalog,
    expectedCatalogDigest: currentCatalog.catalogDigest,
    admissionRequest: clone(admissionRequestRaw) as unknown as CommonsAdmissionRequest,
    admissionResult: clone(admissionResultRaw) as unknown as CommonsAdmissionResult,
    operations: clone(operationsRaw) as unknown as CommonsCatalogOperation[],
    actor: "GARPA projection fixture",
    updatedAt: "2026-08-23T05:30:00Z",
  };
  const result = applyCommonsCatalogUpdate(request);
  expect(result.gate.passed, JSON.stringify(result.gate.findings)).toBe(true);
  return result.catalog!;
}

function request(fullEvidence = false): CommonsComponentProjectionRequest {
  const currentCatalog = catalog();
  const entry = currentCatalog.componentObservationEntries[0]!;
  const revision = entry.revisions.find((item) => item.state === "current")!;
  const receiptContent: CommonsCompatibilityAdmissionReceiptContent = {
    receiptId: "commons-closure:GARPA-TARGET-PROJECTION-1:sensor-v1",
    targetCaseId: "GARPA-TARGET-PROJECTION-1",
    targetMissionOutcomeDigest: "1".repeat(64),
    targetCapabilityGraphDigest: "2".repeat(64),
    nominationId: "nominate-sensor-v1",
    disposition: "compatibility_admitted",
    catalogObjectId: entry.catalogObjectId,
    revisionId: revision.revisionId,
    objectDigest: revision.objectDigest,
    sourceCaseId: revision.sourceCaseId,
    sourceReleaseId: revision.sourceReleaseId,
    sourceReleaseDigest: revision.sourceReleaseDigest,
    targetFunctionIds: ["f-observe-target"],
    targetInterfaceIds: ["i-world-target", "i-observation-target"],
    targetExecutionClass: "E2_bench_passive",
    targetIdentityReceiptIds: ["identity-receipt:sensor-v1"],
    targetCompatibilityReceiptIds: ["compatibility-receipt:i-world", "compatibility-receipt:i-observation"],
    targetEnvironmentReceiptIds: ["environment-receipt:controlled-fixture"],
    targetQualificationReceiptIds: fullEvidence ? ["qualification-receipt:observe-target"] : [],
  };
  const targetEvidence = {
    targetCaseId: "GARPA-TARGET-PROJECTION-1",
    componentKind: "commercial_hardware" as const,
    identityEvidenceCellIds: ["target-evidence:identity:sensor-v1"],
    performanceEvidenceCellIds: fullEvidence
      ? ["target-evidence:performance:sensor-v1"]
      : [],
    licenseEvidenceCellIds: fullEvidence
      ? ["target-evidence:license:sensor-v1"]
      : [],
    operatingRequirementEvidenceCellIds: fullEvidence
      ? ["target-evidence:requirements:sensor-v1"]
      : [],
    securityEvidenceCellIds: fullEvidence
      ? ["target-evidence:security:sensor-v1"]
      : [],
    performanceEnvelope: fullEvidence
      ? { detection_mode: "passive synthetic fixture", sample_rate: "10 Hz" }
      : {},
    operatingRequirements: fullEvidence
      ? { power: "5 VDC", network: "isolated local Ethernet" }
      : {},
    license: fullEvidence ? "Target-case commercial evaluation license" : undefined,
    licenseNotApplicable: false,
    sourceAvailability: fullEvidence ? "Target-case supplier record captured 2026-08-23" : undefined,
    securityNotes: fullEvidence ? ["Target-case review found no unresolved network credential dependency."] : [],
    price: fullEvidence
      ? {
          amount: 125,
          currency: "USD",
          capturedAt: "2026-08-23T17:00:00Z",
          evidenceCellIds: ["target-evidence:price:sensor-v1"],
          includedCostCategories: ["hardware"],
          excludedCostCategories: ["integration_labor", "qualification"],
        }
      : undefined,
    availability: fullEvidence
      ? {
          state: "in_stock" as const,
          capturedAt: "2026-08-23T17:00:00Z",
          evidenceCellIds: ["target-evidence:availability:sensor-v1"],
          note: "Exact version listed in stock at capture time.",
        }
      : undefined,
    integrationRequirements: fullEvidence
      ? ["Run the target observation adapter and timestamp interface test."]
      : ["Target integration work remains unresolved."],
    limitations: ["Projection is bounded to the target synthetic fixture."],
    residuals: ["Performance outside the target fixture remains unassessed."],
  };
  return {
    schemaVersion: 1,
    projectionId: "projection:GARPA-TARGET-PROJECTION-1:sensor-v1",
    catalog: currentCatalog,
    expectedCatalogDigest: currentCatalog.catalogDigest,
    compatibilityAdmissionReceipt: {
      ...receiptContent,
      receiptDigest: computeCompatibilityAdmissionReceiptDigest(receiptContent),
    },
    targetComponentId: "target-component-sensor-v1",
    targetEvidence,
    economicBoundaryRequired: true,
    createdAt: "2026-08-23T17:35:00Z",
  };
}

describe("GARPA Commons component projection validation", () => {
  it("validates a source-bound compatibility-admitted projection request", () => {
    const result = validateCommonsComponentProjectionRequest(request());
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects a forged closure receipt digest", () => {
    const value = request();
    value.compatibilityAdmissionReceipt.receiptDigest = "f".repeat(64);
    const result = validateCommonsComponentProjectionRequest(value);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("digest is invalid");
  });
});

describe("GARPA Commons component projection gate", () => {
  it("projects exact identity and target mappings while withholding unsupported source fields", () => {
    const value = request(false);
    const source = value.catalog.componentObservationEntries[0]!.revisions[0]!.value;
    const result = runCommonsComponentProjectionGate(value);
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.readiness).toBe("component_candidate");
    expect(result.projected?.component.product).toBe(source.componentIdentity.product);
    expect(result.projected?.component.exactModelOrVersion).toBe(
      source.componentIdentity.exactModelOrVersion,
    );
    expect(result.projected?.component.functionIds).toEqual(["f-observe-target"]);
    expect(result.projected?.component.interfaceIds).toEqual([
      "i-world-target",
      "i-observation-target",
    ]);
    expect(result.projected?.component.price).toBeUndefined();
    expect(result.projected?.component.availability).toBeUndefined();
    expect(result.projected?.component.license).toBeUndefined();
    expect(result.projected?.component.performanceEnvelope).toEqual({});
    expect(result.projected?.component.maturity).toBe("community_reported");
    expect(result.projected?.component.lifecycle).toBe("unverified");
    expect(result.projected?.withheldFields).toContain("price");
    expect(result.projected?.withheldFields).toContain("performanceEnvelope");
  });

  it("reaches substitution readiness only with target evidence and target qualification custody", () => {
    const result = runCommonsComponentProjectionGate(request(true));
    expect(result.passed, JSON.stringify(result.findings)).toBe(true);
    expect(result.readiness).toBe("substitution_ready");
    expect(result.projected?.component.maturity).toBe("bench_reproduced");
    expect(result.projected?.component.lifecycle).toBe("available");
    expect(result.projected?.component.price?.amount).toBe(125);
    expect(result.projected?.withheldFields).toEqual([]);
    expect(result.projected?.component.maturity).not.toBe("locally_qualified");
  });

  it("blocks a stale catalog digest", () => {
    const value = request();
    value.expectedCatalogDigest = "a".repeat(64);
    const result = runCommonsComponentProjectionGate(value);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("catalog_digest_mismatch");
  });

  it("blocks a forged source revision coordinate", () => {
    const value = request();
    const content = {
      ...value.compatibilityAdmissionReceipt,
      revisionId: "missing-revision@99",
    };
    const { receiptDigest: _old, ...withoutDigest } = content;
    value.compatibilityAdmissionReceipt = {
      ...withoutDigest,
      receiptDigest: computeCompatibilityAdmissionReceiptDigest(withoutDigest),
    };
    const result = runCommonsComponentProjectionGate(value);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("source_revision_missing");
  });

  it("blocks a non-current source revision", () => {
    const value = request();
    const entry = value.catalog.componentObservationEntries[0]!;
    entry.revisions[0]!.state = "withdrawn";
    entry.currentRevisionId = undefined;
    value.catalog.revision += 1;
    value.catalog.updatedAt = "2026-08-23T17:34:00Z";
    value.catalog.catalogDigest = computeCommonsCatalogDigest(value.catalog);
    value.expectedCatalogDigest = value.catalog.catalogDigest;
    const result = runCommonsComponentProjectionGate(value);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("source_revision_not_current");
  });

  it("blocks projection without target identity evidence", () => {
    const value = request();
    value.targetEvidence.identityEvidenceCellIds = [];
    const result = runCommonsComponentProjectionGate(value);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("target_identity_evidence_missing");
  });

  it("renders the evidence-withholding boundary", () => {
    const value = request();
    const result = runCommonsComponentProjectionGate(value);
    const markdown = renderCommonsComponentProjectionMarkdown(value, result);
    expect(markdown).toContain("## Withheld source fields");
    expect(markdown).toContain("performanceEnvelope");
    expect(markdown).toContain("cannot transfer");
    expect(markdown).toContain("substitution readiness");
  });
});
