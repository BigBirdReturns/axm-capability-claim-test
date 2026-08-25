import type {
  ExternalPublicationArtifact,
  ExternalPublicationReceipt,
  ExternalPublicationReceiptRequest,
  ExternalPublicationReceiptResult,
} from "../../types/garpaExternalPublication";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

function sorted(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function canonicalExternalPublicationArtifacts(
  artifacts: ExternalPublicationArtifact[],
): ExternalPublicationArtifact[] {
  return [...artifacts]
    .map((artifact) => ({ ...artifact }))
    .sort((left, right) => left.artifactId.localeCompare(right.artifactId));
}

export function canonicalExternalPublicationReceipt(
  receipt: ExternalPublicationReceipt,
): ExternalPublicationReceipt {
  return {
    ...receipt,
    artifactIds: sorted(receipt.artifactIds),
  };
}

export function computeExternalPublicationArtifactSetDigest(
  artifacts: ExternalPublicationArtifact[],
): string {
  return sha256Hex(
    canonicalStringify(canonicalExternalPublicationArtifacts(artifacts)),
  );
}

export function computeExternalPublicationReceiptDigest(
  receipt: ExternalPublicationReceipt,
): string {
  const { receiptDigest: _ignored, ...content } =
    canonicalExternalPublicationReceipt(receipt);
  return sha256Hex(canonicalStringify(content));
}

export function computeExternalPublicationReceiptRequestDigest(
  request: ExternalPublicationReceiptRequest,
): string {
  return sha256Hex(
    canonicalStringify({
      ...request,
      receipt: canonicalExternalPublicationReceipt(request.receipt),
      artifacts: canonicalExternalPublicationArtifacts(request.artifacts),
    }),
  );
}

export function computeExternalPublicationReceiptResultDigest(
  result: ExternalPublicationReceiptResult,
): string {
  return sha256Hex(canonicalStringify(result));
}
