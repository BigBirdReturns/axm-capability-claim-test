import { describe, expect, it } from "vitest";
import buildReceiptRaw from "../../examples/garpa-synthetic-observation/build-receipt.json";
import testRunReceiptRaw from "../../examples/garpa-synthetic-observation/test-run-receipt.json";
import type { BuildReceipt } from "../../app/src/types/garpaExecution";
import {
  validateBuildReceipt,
  validateTestRunReceipt,
} from "../../app/src/lib/garpa/validateExecutionReceipts";
import { runPreflightGate } from "../../app/src/lib/garpa/runPreflightGate";

function validBuild(): BuildReceipt {
  const result = validateBuildReceipt(buildReceiptRaw);
  expect(result.ok, result.errors.join("; ")).toBe(true);
  return result.value!;
}

const ready = {
  fixtureReady: true,
  instrumentationReady: true,
  calibrationReady: true,
  storageReady: true,
  clocksReady: true,
  authorityReady: true,
  hazardControlsReady: true,
  abortPathReady: true,
  operatorRolesReady: true,
  runIdReserved: true,
};

describe("GARPA build receipt validation", () => {
  it("accepts an exact assembled build receipt", () => {
    const result = validateBuildReceipt(buildReceiptRaw);
    expect(result.ok, result.errors.join("; ")).toBe(true);
    expect(result.value?.state).toBe("assembled");
  });

  it("requires completedAt for an assembled build", () => {
    const raw = structuredClone(buildReceiptRaw);
    delete (raw as { completedAt?: string }).completedAt;
    const result = validateBuildReceipt(raw);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("assembled builds require completedAt");
  });

  it("rejects substitutions that point to an absent installed item", () => {
    const raw = structuredClone(buildReceiptRaw);
    raw.substitutions.push({
      id: "sub-1",
      originalManifestItemId: "camera-1",
      replacementInstalledItemId: "missing-installed-item",
      requiredRegressionTestIds: ["interface-camera"],
      rationale: "Synthetic hostile fixture",
    });
    const result = validateBuildReceipt(raw);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("unknown installed item");
  });
});

describe("GARPA test run receipt validation", () => {
  it("accepts a valid run with raw-data custody", () => {
    const result = validateTestRunReceipt(testRunReceiptRaw);
    expect(result.ok, result.errors.join("; ")).toBe(true);
    expect(result.value?.metricResults[0]?.thresholdResult).toBe("pass");
  });

  it("rejects a metric that cites raw data absent from the run receipt", () => {
    const raw = structuredClone(testRunReceiptRaw);
    raw.metricResults[0]!.rawSampleArtifactIds = ["ghost-raw-data"];
    const result = validateTestRunReceipt(raw);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("absent from rawDataArtifactIds");
  });

  it("does not permit an invalidating anomaly inside a valid run", () => {
    const raw = structuredClone(testRunReceiptRaw);
    raw.anomalies.push({
      id: "anomaly-1",
      occurredAt: "2026-08-23T05:05:00Z",
      description: "Ground-truth clock lost synchronization.",
      affectedMetricIds: ["metric-detect-before-boundary"],
      disposition: "invalidates_run",
    });
    const result = validateTestRunReceipt(raw);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("valid runs cannot contain");
  });

  it("requires an abort receipt when the run state is aborted", () => {
    const raw = structuredClone(testRunReceiptRaw);
    raw.state = "aborted";
    raw.metricResults = [];
    const result = validateTestRunReceipt(raw);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("aborted runs require an abort receipt");
  });
});

describe("GARPA preflight gate", () => {
  it("passes only a current assembled build with every readiness control", () => {
    const buildReceipt = validBuild();
    const result = runPreflightGate({
      expectedManifestDigest: buildReceipt.manifestDigest,
      expectedQualificationContractDigest: buildReceipt.qualificationContractDigest,
      buildReceipt,
      readiness: ready,
    });
    expect(result.passed).toBe(true);
    expect(result.blockingReasons).toEqual([]);
  });

  it("blocks stale digests and incomplete readiness", () => {
    const buildReceipt = validBuild();
    const result = runPreflightGate({
      expectedManifestDigest: "manifest:new",
      expectedQualificationContractDigest: "qualification:new",
      buildReceipt,
      readiness: { ...ready, calibrationReady: false, authorityReady: false },
    });
    expect(result.passed).toBe(false);
    expect(result.manifestCurrent).toBe(false);
    expect(result.qualificationContractCurrent).toBe(false);
    expect(result.blockingReasons).toContain("required calibration is not current");
    expect(result.blockingReasons).toContain("required venue or test authority is absent");
  });

  it("blocks an open material build deviation", () => {
    const buildReceipt = validBuild();
    buildReceipt.deviations.push({
      id: "deviation-1",
      description: "Timing source differs from the frozen manifest.",
      severity: "material",
      affectedFunctionIds: ["record-result"],
      affectedMetricIds: ["metric-detect-before-boundary"],
      closureState: "open",
      evidenceArtifactIds: [],
    });
    const result = runPreflightGate({
      expectedManifestDigest: buildReceipt.manifestDigest,
      expectedQualificationContractDigest: buildReceipt.qualificationContractDigest,
      buildReceipt,
      readiness: ready,
    });
    expect(result.passed).toBe(false);
    expect(result.materialDeviationsClosed).toBe(false);
  });
});
