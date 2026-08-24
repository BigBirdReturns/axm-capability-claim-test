import type { GarpaReleaseManifest, ReleaseFileRecord } from "../../types/garpaRelease";
import type {
  CommonsSeededReleaseEnvelope,
  CommonsSeededReleaseFilePayload,
  CommonsSeededReleaseResult,
} from "../../types/garpaCommonsSeededRelease";
import { canonicalStringify } from "./canonicalJson";
import { sha256Hex } from "./sha256";

export function releaseFileRecord(
  file: CommonsSeededReleaseFilePayload,
): ReleaseFileRecord {
  return {
    path: file.path,
    sha256: file.sha256,
    byteLength: file.byteLength,
    mediaType: file.mediaType,
    role: file.role,
    required: file.required,
  };
}

export function canonicalReleaseFilePayloads(
  files: CommonsSeededReleaseFilePayload[],
): CommonsSeededReleaseFilePayload[] {
  return [...files]
    .map((file) => ({ ...file }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function canonicalReleaseFileRecords(
  files: ReleaseFileRecord[],
): ReleaseFileRecord[] {
  return [...files]
    .map((file) => ({ ...file }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function computeUtf8ByteLength(content: string): number {
  return new TextEncoder().encode(content).byteLength;
}

export function computeReleaseFileContentDigest(content: string): string {
  return sha256Hex(content);
}

export function computeCommonsSeededReleaseManifestDigest(
  manifest: GarpaReleaseManifest,
): string {
  const { manifestDigest: _ignored, ...content } = manifest;
  return sha256Hex(
    canonicalStringify({
      ...content,
      files: canonicalReleaseFileRecords(content.files),
    }),
  );
}

export function computeCommonsSeededReleaseFileSetDigest(
  files: CommonsSeededReleaseFilePayload[],
): string {
  return sha256Hex(
    canonicalStringify(
      canonicalReleaseFilePayloads(files).map(releaseFileRecord),
    ),
  );
}

export function computeCommonsSeededReleaseBundleDigest(
  files: CommonsSeededReleaseFilePayload[],
): string {
  return sha256Hex(canonicalStringify(canonicalReleaseFilePayloads(files)));
}

export function computeCommonsSeededReleaseEnvelopeDigest(
  envelope: CommonsSeededReleaseEnvelope,
): string {
  const { envelopeDigest: _ignored, ...content } = envelope;
  return sha256Hex(canonicalStringify(content));
}

export function computeCommonsSeededReleaseResultDigest(
  result: CommonsSeededReleaseResult,
): string {
  return sha256Hex(canonicalStringify(result));
}
