#!/usr/bin/env -S npx tsx
import { readFile } from "node:fs/promises";
import { validateClaimPacket, validateMissionOutcome } from "../app/src/lib/garpa/validateClaimPacket.ts";
import { runGarpaAdmission } from "../app/src/lib/garpa/runGarpaAdmission.ts";
import { renderGarpaRealityBrief } from "../app/src/lib/garpa/renderRealityBrief.ts";
import { validateBuildReceipt, validateTestRunReceipt } from "../app/src/lib/garpa/validateExecutionReceipts.ts";
import { validatePreflightReceipt } from "../app/src/lib/garpa/validatePreflightReceipt.ts";
import { createPreflightReceipt } from "../app/src/lib/garpa/runReceiptCustodyGate.ts";
import { evaluateMissionAdequacyWithCustody } from "../app/src/lib/garpa/evaluateMissionAdequacyWithCustody.ts";
import type { MissionEvaluationScope } from "../app/src/types/garpaEvaluation.ts";
import type { PreflightReadiness } from "../app/src/types/garpaExecution.ts";

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function fail(stage: string, errors: string[]): never {
  process.stderr.write(`${JSON.stringify({ ok: false, stage, errors }, null, 2)}\n`);
  process.exit(1);
}

function blocked(payload: unknown): never {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(2);
}

async function runAdmission(args: string[]): Promise<void> {
  if (args.length !== 2) {
    fail("arguments", ["Usage: garpaCli.ts admission CLAIM_PACKET.json MISSION_OUTCOME.json"]);
  }
  const packet = validateClaimPacket(await readJson(args[0]!));
  if (!packet.ok || !packet.value) fail("claim_packet", packet.errors);
  const outcome = validateMissionOutcome(await readJson(args[1]!), packet.value);
  if (!outcome.ok || !outcome.value) fail("mission_outcome", outcome.errors);
  const admission = runGarpaAdmission(packet.value, outcome.value);
  const payload = {
    ok: true,
    admissionBlocked: !admission.passed,
    admission,
    realityBrief: renderGarpaRealityBrief(packet.value, outcome.value, admission),
  };
  if (!admission.passed) blocked(payload);
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

interface PreflightRequestFile {
  caseId: string;
  runId: string;
  expectedManifestDigest: string;
  expectedQualificationContractDigest: string;
  readiness: PreflightReadiness;
  evaluatedAt: string;
  preflightDigest: string;
}

async function runPreflight(args: string[]): Promise<void> {
  if (args.length !== 2) {
    fail("arguments", ["Usage: garpaCli.ts preflight BUILD_RECEIPT.json PREFLIGHT_REQUEST.json"]);
  }
  const build = validateBuildReceipt(await readJson(args[0]!));
  if (!build.ok || !build.value) fail("build_receipt", build.errors);
  const request = (await readJson(args[1]!)) as PreflightRequestFile;
  const receipt = createPreflightReceipt({
    caseId: request.caseId,
    runId: request.runId,
    evaluatedAt: request.evaluatedAt,
    preflightDigest: request.preflightDigest,
    preflight: {
      expectedManifestDigest: request.expectedManifestDigest,
      expectedQualificationContractDigest: request.expectedQualificationContractDigest,
      buildReceipt: build.value,
      readiness: request.readiness,
    },
  });
  const payload = { ok: true, preflightBlocked: !receipt.gate.passed, receipt };
  if (!receipt.gate.passed) blocked(payload);
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

interface EvaluationFile {
  scope: MissionEvaluationScope;
  testRunReceipts: unknown[];
  preflightReceipts: unknown[];
}

async function runEvaluation(args: string[]): Promise<void> {
  if (args.length !== 1) {
    fail("arguments", ["Usage: garpaCli.ts evaluate EVALUATION_INPUT.json"]);
  }
  const input = (await readJson(args[0]!)) as EvaluationFile;
  const runs = input.testRunReceipts.map((raw, index) => {
    const result = validateTestRunReceipt(raw);
    if (!result.ok || !result.value) {
      fail(`testRunReceipts.${index}`, result.errors);
    }
    return result.value;
  });
  const preflights = input.preflightReceipts.map((raw, index) => {
    const result = validatePreflightReceipt(raw);
    if (!result.ok || !result.value) {
      fail(`preflightReceipts.${index}`, result.errors);
    }
    return result.value;
  });
  const evaluation = evaluateMissionAdequacyWithCustody({
    scope: input.scope,
    testRunReceipts: runs,
    preflightReceipts: preflights,
  });
  process.stdout.write(`${JSON.stringify({ ok: true, evaluation }, null, 2)}\n`);
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command === "admission") return runAdmission(args);
  if (command === "preflight") return runPreflight(args);
  if (command === "evaluate") return runEvaluation(args);
  fail("command", [
    "Usage: garpaCli.ts admission CLAIM_PACKET.json MISSION_OUTCOME.json",
    "       garpaCli.ts preflight BUILD_RECEIPT.json PREFLIGHT_REQUEST.json",
    "       garpaCli.ts evaluate EVALUATION_INPUT.json",
  ]);
}

await main();
