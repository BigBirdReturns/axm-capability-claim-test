import type { TestRunReceipt } from "../../types/garpaExecution";
import type {
  CommonsSeededTestRunEnvelope,
  CommonsSeededTestRunResult,
} from "../../types/garpaCommonsSeededTestRun";
import type { CommonsSeededPreflightRequest } from "../../types/garpaCommonsSeededPreflight";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

export function computeSeededExecutionConfigurationDigest(
  request: CommonsSeededPreflightRequest,
): string {
  const preflight = request.preflightReceipt;
  return sha256Hex(
    canonicalStringify({
      asBuiltReceiptDigest: preflight.asBuiltReceiptDigest,
      preflightReceiptDigest: preflight.receiptDigest,
      fixtures: preflight.fixtureChecks.map((item) => ({
        fixtureId: item.fixtureId,
        configurationDigest: item.configurationDigest,
      })),
      instrumentation: preflight.instrumentationChecks.map((item) => ({
        instrumentationId: item.instrumentationId,
        exactModelOrVersion: item.exactModelOrVersion,
        configurationDigest: item.configurationDigest,
        calibrationState: item.calibrationState,
        storagePath: item.storagePath,
      })),
    }),
  );
}

export function computeCommonsSeededTestRunReceiptDigest(
  receipt: TestRunReceipt,
): string {
  const { resultDigest: _ignored, ...content } = receipt;
  return sha256Hex(canonicalStringify(content));
}

export function computeCommonsSeededTestRunEnvelopeDigest(
  envelope: CommonsSeededTestRunEnvelope,
): string {
  const { envelopeDigest: _ignored, ...content } = envelope;
  return sha256Hex(canonicalStringify(content));
}

export function computeCommonsSeededTestRunResultDigest(
  result: CommonsSeededTestRunResult,
): string {
  return sha256Hex(canonicalStringify(result));
}
