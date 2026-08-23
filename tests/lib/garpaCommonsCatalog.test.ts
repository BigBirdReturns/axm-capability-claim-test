import { describe, expect, it } from "vitest";
import admissionRequestFixture from "../../examples/garpa-commons/commons-request.json";
import admissionResultFixture from "../../examples/garpa-commons/commons-result.json";
import emptyCatalogFixture from "../../examples/garpa-commons-catalog/empty-catalog.json";
import operationsFixture from "../../examples/garpa-commons-catalog/operations.json";
import type {
  CommonsAdmissionRequest,
  CommonsAdmissionResult,
} from "../../app/src/types/garpaCommons";
import type {
  CommonsCatalog,
  CommonsCatalogOperation,
  CommonsCatalogUpdateRequest,
} from "../../app/src/types/garpaCommonsCatalog";
import { sha256Hex } from "../../app/src/lib/garpa/sha256";
import { computeCommonsCatalogDigest } from "../../app/src/lib/garpa/commonsCatalogDigest";
import {
  validateCommonsCatalog,
  validateCommonsCatalogUpdateRequest,
} from "../../app/src/lib/garpa/validateCommonsCatalog";
import { runCommonsAdmissionGate } from "../../app/src/lib/garpa/runCommonsAdmissionGate";
import { runCommonsCatalogUpdateGate } from "../../app/src/lib/garpa/runCommonsCatalogUpdateGate";
import { applyCommonsCatalogUpdate } from "../../app/src/lib/garpa/applyCommonsCatalogUpdate";
import { searchCommonsCatalog } from "../../app/src/lib/garpa/searchCommonsCatalog";
import {
  renderCommonsCatalogUpdateMarkdown,
  renderCommonsSearchMarkdown,
} from "../../app/src/lib/garpa/renderCommonsCatalogUpdate";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function admissionRequest(): CommonsAdmissionRequest {
  return clone(admissionRequestFixture) as unknown as CommonsAdmissionRequest;
}

function admissionResult(): CommonsAdmissionResult {
  return clone(admissionResultFixture) as unknown as CommonsAdmissionResult;
}

function emptyCatalog(): CommonsCatalog {
  return clone(emptyCatalogFixture) as unknown as CommonsCatalog;
}

function operations(): CommonsCatalogOperation[] {
  return clone(operationsFixture) as unknown as CommonsCatalogOperation[];
}

function updateRequest(): CommonsCatalogUpdateRequest {
  const catalog = emptyCatalog();
  return {
    schemaVersion: 1,
    currentCatalog: catalog,
    expectedCatalogDigest: catalog.catalogDigest,
    admissionRequest: admissionRequest(),
    admissionResult: admissionResult(),
    operations: operations(),
    actor: "GARPA synthetic fixture",
    updatedAt: "2026-08-23T05:30:00Z",
  };
}

function initialCatalog(): CommonsCatalog {
  const applied = applyCommonsCatalogUpdate(updateRequest());
  expect(applied.gate.passed).toBe(true);
  expect(applied.catalog).toBeDefined();
  return applied.catalog!;
}

function primitiveOnlyRelease(
  sourceReleaseId: string,
  sourceReleaseDigest: string,
): CommonsAdmissionRequest {
  const request = admissionRequest();
  const primitive = clone(request.primitives[0]!);
  primitive.sourceReleaseIds = [sourceReleaseId];
  primitive.observedImplementations = primitive.observedImplementations.map((item) => ({
    ...item,
    releaseId: sourceReleaseId,
    architecturePatternIds: [],
  }));
  primitive.qualificationRefs = primitive.qualificationRefs.map((item) => ({
    ...item,
    releaseId: sourceReleaseId,
  }));
  return {
    schemaVersion: 1,
    sourceCaseId: request.sourceCaseId,
    sourceReleaseId,
    sourceReleaseDigest,
    releaseVerificationState: "current_valid",
    primitives: [primitive],
    componentObservations: [],
    architecturePatterns: [],
  };
}

describe("GARPA commons catalog hashing and validation", () => {
  it("uses a portable SHA-256 implementation with known vectors", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("validates the empty catalog and its canonical digest", () => {
    const catalog = emptyCatalog();
    expect(computeCommonsCatalogDigest(catalog)).toBe(catalog.catalogDigest);
    const result = validateCommonsCatalog(catalog);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("validates the complete update envelope", () => {
    const result = validateCommonsCatalogUpdateRequest(updateRequest());
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects a catalog whose content changed without a new digest", () => {
    const catalog = initialCatalog();
    catalog.primitiveEntries[0]!.revisions[0]!.value.residuals.push(
      "Unreceipted mutation",
    );
    const result = validateCommonsCatalog(catalog);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("object digest");
    expect(result.errors.join(" ")).toContain("catalogDigest");
  });
});

describe("GARPA commons catalog update gate", () => {
  it("creates one revision chain for every admitted commons object", () => {
    const result = applyCommonsCatalogUpdate(updateRequest());
    expect(result.gate.passed).toBe(true);
    expect(result.gate.state).toBe("catalog_update_admitted");
    expect(result.catalog?.revision).toBe(1);
    expect(result.catalog?.primitiveEntries[0]?.currentRevisionId).toBe(
      "primitive-detect-before-boundary@1",
    );
    expect(result.catalog?.componentObservationEntries[0]?.currentRevisionId).toBe(
      "observation-sensor-v1-controlled-fixture@1",
    );
    expect(result.catalog?.architecturePatternEntries[0]?.currentRevisionId).toBe(
      "pattern-observe-detect-present@1",
    );
    expect(validateCommonsCatalog(result.catalog).ok).toBe(true);
  });

  it("blocks a stale expected catalog digest", () => {
    const request = updateRequest();
    request.expectedCatalogDigest = "a".repeat(64);
    const result = runCommonsCatalogUpdateGate(request);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("catalog_digest_mismatch");
  });

  it("blocks a forged admission result", () => {
    const request = updateRequest();
    request.admissionResult.admittedPrimitiveIds = [];
    const result = runCommonsCatalogUpdateGate(request);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("admission_result_mismatch");
  });

  it("requires exactly one operation for every admitted object", () => {
    const request = updateRequest();
    request.operations = request.operations.slice(0, 2);
    const result = runCommonsCatalogUpdateGate(request);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("operation_coverage_incomplete");
  });

  it("supports partial admission without cataloging the blocked component", () => {
    const request = updateRequest();
    request.admissionRequest.componentObservations[0]!.runReceiptIds = [];
    request.admissionResult = runCommonsAdmissionGate(request.admissionRequest);
    request.operations = request.operations.filter(
      (operation) => operation.objectType !== "component_observation",
    );
    const result = applyCommonsCatalogUpdate(request);
    expect(result.gate.passed).toBe(true);
    expect(result.catalog?.primitiveEntries).toHaveLength(1);
    expect(result.catalog?.componentObservationEntries).toHaveLength(0);
    expect(result.catalog?.architecturePatternEntries).toHaveLength(1);
  });

  it("blocks a new catalog id that collides with an existing stable identity", () => {
    const catalog = initialCatalog();
    const incoming = primitiveOnlyRelease(
      "GARPA-PUBLICATION-0001-R2",
      "e".repeat(64),
    );
    incoming.primitives[0]!.primitiveId = "primitive-detect-before-boundary-copy";
    const request: CommonsCatalogUpdateRequest = {
      schemaVersion: 1,
      currentCatalog: catalog,
      expectedCatalogDigest: catalog.catalogDigest,
      admissionRequest: incoming,
      admissionResult: runCommonsAdmissionGate(incoming),
      operations: [
        {
          operationId: "identity-collision",
          objectType: "primitive",
          incomingObjectId: incoming.primitives[0]!.primitiveId,
          action: "create",
          catalogObjectId: incoming.primitives[0]!.primitiveId,
          aliasesAdded: [],
          reason: "Hostile identity-collision fixture.",
        },
      ],
      actor: "GARPA hostile fixture",
      updatedAt: "2026-08-23T06:00:00Z",
    };
    const result = runCommonsCatalogUpdateGate(request);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("catalog_identity_conflict");
  });

  it("supersedes changed content without overwriting revision 1", () => {
    const catalog = initialCatalog();
    const incoming = primitiveOnlyRelease(
      "GARPA-PUBLICATION-0001-R2",
      "e".repeat(64),
    );
    incoming.primitives[0]!.residuals.push(
      "R2 preserves the same controlled-fixture scope.",
    );
    const request: CommonsCatalogUpdateRequest = {
      schemaVersion: 1,
      currentCatalog: catalog,
      expectedCatalogDigest: catalog.catalogDigest,
      admissionRequest: incoming,
      admissionResult: runCommonsAdmissionGate(incoming),
      operations: [
        {
          operationId: "supersede-primitive-r2",
          objectType: "primitive",
          incomingObjectId: "primitive-detect-before-boundary",
          action: "supersede",
          catalogObjectId: "primitive-detect-before-boundary",
          expectedCurrentRevisionId: "primitive-detect-before-boundary@1",
          aliasesAdded: [],
          reason: "Record the admitted R2 source lineage and residual.",
        },
      ],
      actor: "GARPA synthetic fixture",
      updatedAt: "2026-08-23T06:00:00Z",
    };
    const result = applyCommonsCatalogUpdate(request);
    const entry = result.catalog?.primitiveEntries[0];
    expect(result.gate.passed).toBe(true);
    expect(entry?.revisions).toHaveLength(2);
    expect(entry?.revisions[0]?.state).toBe("superseded");
    expect(entry?.revisions[1]?.state).toBe("current");
    expect(entry?.revisions[1]?.supersedesRevisionId).toBe(
      "primitive-detect-before-boundary@1",
    );
  });

  it("admits an exact replay as a no-op without advancing revision or digest", () => {
    const catalog = initialCatalog();
    const current = clone(catalog.primitiveEntries[0]!.revisions[0]!.value);
    const currentPattern = clone(
      catalog.architecturePatternEntries[0]!.revisions[0]!.value,
    );
    const incoming: CommonsAdmissionRequest = {
      schemaVersion: 1,
      sourceCaseId: catalog.primitiveEntries[0]!.revisions[0]!.sourceCaseId,
      sourceReleaseId: catalog.primitiveEntries[0]!.revisions[0]!.sourceReleaseId,
      sourceReleaseDigest:
        catalog.primitiveEntries[0]!.revisions[0]!.sourceReleaseDigest,
      releaseVerificationState: "current_valid",
      primitives: [current],
      componentObservations: [],
      architecturePatterns: [currentPattern],
    };
    const request: CommonsCatalogUpdateRequest = {
      schemaVersion: 1,
      currentCatalog: catalog,
      expectedCatalogDigest: catalog.catalogDigest,
      admissionRequest: incoming,
      admissionResult: runCommonsAdmissionGate(incoming),
      operations: [
        {
          operationId: "noop-primitive-r1",
          objectType: "primitive",
          incomingObjectId: current.primitiveId,
          action: "noop",
          catalogObjectId: current.primitiveId,
          expectedCurrentRevisionId: "primitive-detect-before-boundary@1",
          aliasesAdded: [],
          reason: "Idempotent replay fixture.",
        },
        {
          operationId: "noop-pattern-r1",
          objectType: "architecture_pattern",
          incomingObjectId: currentPattern.patternId,
          action: "noop",
          catalogObjectId: currentPattern.patternId,
          expectedCurrentRevisionId: "pattern-observe-detect-present@1",
          aliasesAdded: [],
          reason: "Idempotent replay fixture.",
        },
      ],
      actor: "GARPA synthetic fixture",
      updatedAt: "2026-08-23T06:00:00Z",
    };
    const result = applyCommonsCatalogUpdate(request);
    expect(result.gate.state).toBe("catalog_noop");
    expect(result.catalog?.revision).toBe(catalog.revision);
    expect(result.catalog?.catalogDigest).toBe(catalog.catalogDigest);
  });

  it("blocks supersession when the stable identity changes", () => {
    const catalog = initialCatalog();
    const incoming = primitiveOnlyRelease(
      "GARPA-PUBLICATION-0001-R2",
      "e".repeat(64),
    );
    incoming.primitives[0]!.name = "A different function";
    const request: CommonsCatalogUpdateRequest = {
      schemaVersion: 1,
      currentCatalog: catalog,
      expectedCatalogDigest: catalog.catalogDigest,
      admissionRequest: incoming,
      admissionResult: runCommonsAdmissionGate(incoming),
      operations: [
        {
          operationId: "wrong-identity-supersession",
          objectType: "primitive",
          incomingObjectId: "primitive-detect-before-boundary",
          action: "supersede",
          catalogObjectId: "primitive-detect-before-boundary",
          expectedCurrentRevisionId: "primitive-detect-before-boundary@1",
          aliasesAdded: [],
          reason: "Hostile identity-change fixture.",
        },
      ],
      actor: "GARPA hostile fixture",
      updatedAt: "2026-08-23T06:00:00Z",
    };
    const result = runCommonsCatalogUpdateGate(request);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("catalog_identity_conflict");
  });
});

describe("GARPA commons catalog search", () => {
  it("returns exact context without a scalar score", () => {
    const catalog = initialCatalog();
    const result = searchCommonsCatalog(catalog, {
      text: "controlled fixture",
      executionClasses: ["E2_bench_passive"],
    });
    expect(result.totalMatches).toBe(3);
    expect(result.hits[0]).not.toHaveProperty("score");
    expect(result.hits.every((hit) => hit.sourceReleaseDigest.length === 64)).toBe(
      true,
    );
    expect(result.hits.some((hit) => hit.fixture?.includes("Controlled indoor"))).toBe(
      true,
    );
  });

  it("excludes superseded revisions by default and returns them on request", () => {
    const catalog = initialCatalog();
    const incoming = primitiveOnlyRelease(
      "GARPA-PUBLICATION-0001-R2",
      "e".repeat(64),
    );
    incoming.primitives[0]!.residuals.push("R2 residual.");
    const applied = applyCommonsCatalogUpdate({
      schemaVersion: 1,
      currentCatalog: catalog,
      expectedCatalogDigest: catalog.catalogDigest,
      admissionRequest: incoming,
      admissionResult: runCommonsAdmissionGate(incoming),
      operations: [
        {
          operationId: "search-supersession",
          objectType: "primitive",
          incomingObjectId: "primitive-detect-before-boundary",
          action: "supersede",
          catalogObjectId: "primitive-detect-before-boundary",
          expectedCurrentRevisionId: "primitive-detect-before-boundary@1",
          aliasesAdded: [],
          reason: "Search-history fixture.",
        },
      ],
      actor: "GARPA synthetic fixture",
      updatedAt: "2026-08-23T06:00:00Z",
    });
    const currentOnly = searchCommonsCatalog(applied.catalog!, {
      objectTypes: ["primitive"],
    });
    const withHistory = searchCommonsCatalog(applied.catalog!, {
      objectTypes: ["primitive"],
      includeSuperseded: true,
    });
    expect(currentOnly.totalMatches).toBe(1);
    expect(withHistory.totalMatches).toBe(2);
    expect(withHistory.hits.map((hit) => hit.revisionState)).toEqual([
      "current",
      "superseded",
    ]);
  });

  it("renders update and search receipts with the governing boundary", () => {
    const request = updateRequest();
    const applied = applyCommonsCatalogUpdate(request);
    const updateMarkdown = renderCommonsCatalogUpdateMarkdown(request, applied);
    const searchMarkdown = renderCommonsSearchMarkdown(
      searchCommonsCatalog(applied.catalog!, { objectTypes: ["component_observation"] }),
    );
    expect(updateMarkdown).toContain("An existing revision is never overwritten");
    expect(updateMarkdown).toContain("Catalog presence does not upgrade maturity");
    expect(searchMarkdown).toContain("does not assign a scalar score");
    expect(searchMarkdown).toContain("source release digest");
  });
});
