import type {
  PreflightGateInput,
  PreflightGateResult,
  PreflightReadiness,
  TestRunReceipt,
} from "./garpaExecution";

export interface PreflightReceipt {
  schemaVersion: 1;
  caseId: string;
  runId: string;
  buildId: string;
  buildDigest: string;
  manifestDigest: string;
  qualificationContractDigest: string;
  readiness: PreflightReadiness;
  gate: PreflightGateResult;
  evaluatedAt: string;
  preflightDigest: string;
}

export interface PreflightReceiptInput {
  caseId: string;
  runId: string;
  preflight: PreflightGateInput;
  evaluatedAt: string;
  preflightDigest: string;
}

export interface ReceiptCustodyGateResult {
  passed: boolean;
  runIdMatches: boolean;
  caseIdMatches: boolean;
  buildDigestMatches: boolean;
  qualificationContractDigestMatches: boolean;
  preflightPassed: boolean;
  preflightPrecedesRun: boolean;
  blockingReasons: string[];
}

export interface ReceiptCustodyGateInput {
  preflightReceipt: PreflightReceipt;
  testRunReceipt: TestRunReceipt;
}
