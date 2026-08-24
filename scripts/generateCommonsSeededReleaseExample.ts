import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalStringify } from "../app/src/lib/garpa/canonicalJson.ts";
import { computeCommonsSeededReleaseResultDigest } from "../app/src/lib/garpa/commonsSeededReleaseDigest.ts";
import { renderCommonsSeededReleaseMarkdown } from "../app/src/lib/garpa/renderCommonsSeededRelease.ts";
import { runCommonsSeededReleaseGate } from "../app/src/lib/garpa/runCommonsSeededReleaseGate.ts";
import { sha256Hex } from "../app/src/lib/garpa/sha256.ts";
import { buildCommonsSeededReleaseRequest } from "../tests/fixtures/garpaCommonsSeededReleaseFixture.ts";

const directory = "examples/garpa-commons-seeded-release";
await mkdir(directory, { recursive: true });
const request = buildCommonsSeededReleaseRequest();
const result = runCommonsSeededReleaseGate(request);
if (!result.passed || !result.releaseVerified) {
  throw new Error(JSON.stringify(result, null, 2));
}
await writeFile(`${directory}/request.json`, `${JSON.stringify(request, null, 2)}\n`);
await writeFile(`${directory}/result.json`, `${JSON.stringify(result, null, 2)}\n`);
await writeFile(
  `${directory}/receipt.md`,
  renderCommonsSeededReleaseMarkdown(request, result),
);
await writeFile(
  `${directory}/manifest.json`,
  `${JSON.stringify(request.releaseManifest, null, 2)}\n`,
);
await mkdir(`${directory}/files`, { recursive: true });
for (const file of request.releaseFiles) {
  const outputPath = `${directory}/files/${file.path}`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, file.content);
}
await writeFile(
  `${directory}/status.json`,
  `${JSON.stringify({
    passed: result.passed,
    state: result.state,
    releaseVerified: result.releaseVerified,
    releaseState: result.releaseState,
    requestDigest: sha256Hex(canonicalStringify(request)),
    resultDigest: computeCommonsSeededReleaseResultDigest(result),
    manifestDigest: result.releaseManifestDigest,
    fileSetDigest: result.fileSetDigest,
    bundleDigest: result.bundleDigest,
    fileCount: request.releaseFiles.length,
  }, null, 2)}\n`,
);
