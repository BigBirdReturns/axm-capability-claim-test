import { describe, expect, it } from "vitest";
import buildReceiptRaw from "../../examples/garpa-synthetic-observation/build-receipt.json";
import preflightReceiptRaw from "../../examples/garpa-synthetic-observation/preflight-receipt.json";
import testRunReceiptRaw from "../../examples/garpa-synthetic-observation/test-run-receipt.json";
import type { PreflightReceipt } from "../../app/src/types/garpaPreflight";
import type { TestRunReceipt } from "../../app/src/types/garpaExecution";
import { validateBuildReceipt, validateTestRunReceipt } from "../../app/src/lib/garpa/validateExecutionReceipts";
import { validatePreflightReceipt } from "../../app/src/lib/garpa/validatePreflightReceipt";
import {
  createPreflightReceipt,
  runReceiptCustodyGate,
} from "../../app/src/lib/garpa/runReceiptCustodyGate";

function validRun(): TestRunReceipt {
  const result = validateTestRunReceipt(testRunReceiptRaw);
  expect(result.ok, result.errors.join("; ")).toBe(true);
  return result.value!;
}

function validPreflight(): PreflightReceipt {
  const result = validatePreflightReceipt(preflightReceiptRaw);
  expect(result.ok, result.errors.join("; ")).toBe(true);
  return result.value!;
}

const readiness = {
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

describe("GARPA preflight receipt", () => {
  it("validates a passing receipt whose duplicate readiness records agree", () => {
    const result = validatePreflightReceipt(preflightReceiptRaw);
    expect(result.ok, result.errors.join("; ")).toBe(true);
    expect(result.value?.gate.passed).toBe(true);
  });

  it("rejects a receipt whose gate readiness differs from its recorded readiness", () => {
    const raw = structuredClone(preflightReceiptRaw) as unknown as PreflightReceipt;
    raw.gate.readiness.calibrationReady = false;
    const result = validatePreflightReceipt(raw);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("readiness differs");
  });

  it("creates the receipt from the actual preflight gate result", () => {
    const build = validateBuildReceipt(buildReceiptRaw);
    expect(build.ok, build.errors.join("; ")).toBe(true);
    const receipt = createPreflightReceipt({
      caseId: "GARPA-SYNTH-OBS-001",
      runId: "RUN-001",
      evaluatedAt: "2026-08-23T04:55:00Z",
      preflightDigest: "preflight:synthetic-observation:run-001",
      preflight: {
        expectedManifestDigest: "manifest:synthetic-observation:v1",
        expectedQualificationContractDigest: "qualification:synthetic-observation:v1",
        buildReceipt: build.value!,
        readiness,
      },
    });
    expect(receipt.gate.passed).toBe(true);
    expect(receipt.buildDigest).toBe("build:synthetic-observation:v1");
  });
});

describe("GARPA run custody gate", () => {
  it("binds a valid run to a passing preflight recorded before execution", () => {
    const result = runReceiptCustodyGate({
      preflightReceipt: validPreflight(),
      testRunReceipt: validRun(),
    });
    expect(result.passed).toBe(true);
    expect(result.blockingReasons).toEqual([]);
  });

  it("blocks a run whose build digest differs from preflight", () => {
    const run = validRun();
    run.buildDigest = "build:other";
    const result = runReceiptCustodyGate({
      preflightReceipt: validPreflight(),
      testRunReceipt: run,
    });
    expect(result.passed).toBe(false);
    expect(result.buildDigestMatches).toBe(false);
  });

  it("blocks a preflight receipt recorded after execution began", () => {
    const preflight = validPreflight();
    preflight.evaluatedAt = "2026-08-23T05:01:00Z";
    const result = runReceiptCustodyGate({
      preflightReceipt: preflight,
      testRunReceipt: validRun(),
    });
    expect(result.passed).toBe(false);
    expect(result.preflightPrecedesRun).toBe(false);
  });

  it("blocks a run attached to a failed preflight gate", () => {
    const preflight = validPreflight();
    preflight.gate = {
      ...preflight.gate,
      passed: false,
      blockingReasons: ["required calibration is not current"],
      readiness: { ...preflight.gate.readiness, calibrationReady: false },
    };
    preflight.readiness = { ...preflight.readiness, calibrationReady: false };
    const result = runReceiptCustodyGate({
      preflightReceipt: preflight,
      testRunReceipt: validRun(),
    });
    expect(result.passed).toBe(false);
    expect(result.preflightPassed).toBe(false);
  });
});
