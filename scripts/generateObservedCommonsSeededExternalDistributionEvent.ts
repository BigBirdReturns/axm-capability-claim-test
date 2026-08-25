import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { canonicalStringify } from "../app/src/lib/garpa/canonicalJson.ts";
import {
  computeCommonsSeededExternalDistributionResultDigest,
} from "../app/src/lib/garpa/commonsSeededExternalDistributionDigest.ts";
import { renderCommonsSeededExternalDistributionMarkdown } from "../app/src/lib/garpa/renderCommonsSeededExternalDistribution.ts";
import { runCommonsSeededExternalDistributionGate } from "../app/src/lib/garpa/runCommonsSeededExternalDistributionGate.ts";
import {
  buildCommonsSeededExternalDistributionRequest,
  refreshCommonsSeededExternalDistributionEnvelope,
} from "../tests/fixtures/garpaCommonsSeededExternalDistributionFixture.ts";

interface EventMetadata {
  schemaVersion: 1;
  repository: string;
  branch: string;
  publishCommit: string;
  evidenceCommit: string;
  releaseId: string;
  destinationUri: string;
  publishedAt: string;
  observedAt: string;
  platformReceiptPath: string;
  retrievalCapturePath: string;
  releaseManifestPath: string;
  releaseManifestObservedSha256: string;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function rawUri(metadata: EventMetadata, path: string): string {
  return `https://raw.githubusercontent.com/${metadata.repository}/${metadata.evidenceCommit}/public/releases/${metadata.releaseId}/${path}`;
}

function addSeconds(value: string, seconds: number): string {
  return new Date(Date.parse(value) + seconds * 1_000).toISOString();
}

const [metadataPath, outputDirectory] = process.argv.slice(2);
if (!metadataPath || !outputDirectory) {
  throw new Error(
    "Usage: npx tsx scripts/generateObservedCommonsSeededExternalDistributionEvent.ts <metadata.json> <output-directory>",
  );
}

const metadata = JSON.parse(
  await readFile(metadataPath, "utf8"),
) as EventMetadata;
const metadataAbsolute = resolve(metadataPath);
const releaseRoot = dirname(dirname(metadataAbsolute));
const platformBytes = await readFile(
  resolve(releaseRoot, metadata.platformReceiptPath),
);
const retrievalBytes = await readFile(
  resolve(releaseRoot, metadata.retrievalCapturePath),
);
const manifestBytes = await readFile(
  resolve(releaseRoot, metadata.releaseManifestPath),
);

const request = buildCommonsSeededExternalDistributionRequest();
const observation = request.distributionObservation;
observation.mode = "observed_external_event";
observation.eventKind = "release_distribution";
observation.channel = "public_repository_release";
observation.destinationUri = metadata.destinationUri;
observation.publishedAt = metadata.publishedAt;
observation.observedAt = metadata.observedAt;
observation.externallyAccessible = true;
observation.syntheticFixture = false;
observation.evidenceArtifacts = [
  {
    artifactId: `github-platform-receipt:${metadata.publishCommit}`,
    sha256: sha256(platformBytes),
    mediaType: "application/json",
    uri: rawUri(metadata, metadata.platformReceiptPath),
    role: "platform_receipt",
    evidenceControl: "externally_attributed",
    capturedAt: metadata.observedAt,
  },
  {
    artifactId: `github-retrieval-capture:${metadata.publishCommit}`,
    sha256: sha256(retrievalBytes),
    mediaType: "application/json",
    uri: rawUri(metadata, metadata.retrievalCapturePath),
    role: "retrieval_capture",
    evidenceControl: "local_measured",
    capturedAt: metadata.observedAt,
  },
  {
    artifactId: `github-content-manifest:${metadata.publishCommit}`,
    sha256: sha256(manifestBytes),
    mediaType: "application/json",
    uri: `https://raw.githubusercontent.com/${metadata.repository}/${metadata.publishCommit}/public/releases/${metadata.releaseId}/${metadata.releaseManifestPath}`,
    role: "content_manifest",
    evidenceControl: "local_measured",
    capturedAt: metadata.observedAt,
  },
];
request.distributionEnvelope.distributionReceiptId =
  `external-distribution:${metadata.releaseId}:github:${metadata.publishCommit}:v1`;
request.distributionEnvelope.evaluatedAt = addSeconds(metadata.observedAt, 1);
request.admittedAt = addSeconds(metadata.observedAt, 2);
refreshCommonsSeededExternalDistributionEnvelope(request);

const result = runCommonsSeededExternalDistributionGate(request);
if (
  !result.passed ||
  result.state !== "seeded_external_distribution_observed" ||
  !result.receiptAdmitted ||
  !result.eventObserved ||
  !result.publicReleaseOccurred ||
  result.publicRegistryPublished
) {
  throw new Error(JSON.stringify(result, null, 2));
}

await mkdir(outputDirectory, { recursive: true });
const requestText = `${JSON.stringify(request, null, 2)}\n`;
const resultText = `${JSON.stringify(result, null, 2)}\n`;
await writeFile(`${outputDirectory}/request.json`, requestText);
await writeFile(`${outputDirectory}/result.json`, resultText);
await writeFile(
  `${outputDirectory}/receipt.md`,
  renderCommonsSeededExternalDistributionMarkdown(request, result),
);
await writeFile(
  `${outputDirectory}/status.json`,
  `${JSON.stringify(
    {
      passed: result.passed,
      state: result.state,
      receiptAdmitted: result.receiptAdmitted,
      eventObserved: result.eventObserved,
      publicReleaseOccurred: result.publicReleaseOccurred,
      publicRegistryPublished: result.publicRegistryPublished,
      mode: result.mode,
      eventKind: result.eventKind,
      repository: metadata.repository,
      branch: metadata.branch,
      publishCommit: metadata.publishCommit,
      evidenceCommit: metadata.evidenceCommit,
      destinationUri: metadata.destinationUri,
      publishedAt: metadata.publishedAt,
      observedAt: metadata.observedAt,
      releaseId: metadata.releaseId,
      releaseManifestDigest: observation.releaseManifestDigest,
      releaseBundleDigest: observation.releaseBundleDigest,
      registryEntryDigest: observation.registryEntryDigest,
      requestDigest: sha256(Buffer.from(canonicalStringify(request))),
      resultDigest: computeCommonsSeededExternalDistributionResultDigest(result),
      observationDigest: result.distributionObservationDigest,
      envelopeDigest: result.distributionEnvelopeDigest,
      observedFileSetDigest: result.observedFileSetDigest,
      evidenceArtifactSetDigest: result.evidenceArtifactSetDigest,
      platformReceiptSha256: sha256(platformBytes),
      retrievalCaptureSha256: sha256(retrievalBytes),
      contentManifestSha256: sha256(manifestBytes),
      methodReceiptHead: "2e4b6e5f786b5a03736f060cac6f6db64d482bed",
      deploymentAuthorityClaimed: false,
      unrestrictedEquivalenceClaimed: false,
    },
    null,
    2,
  )}\n`,
);
