import { mkdir, writeFile } from "node:fs/promises";
import { canonicalStringify } from "../app/src/lib/garpa/canonicalJson.ts";
import { computeCommonsSeededPublicRegistryResultDigest } from "../app/src/lib/garpa/commonsSeededPublicRegistryDigest.ts";
import { renderCommonsSeededPublicRegistryMarkdown } from "../app/src/lib/garpa/renderCommonsSeededPublicRegistry.ts";
import { renderRegistryUpdateMarkdown } from "../app/src/lib/garpa/renderRegistryUpdate.ts";
import { runCommonsSeededPublicRegistryGate } from "../app/src/lib/garpa/runCommonsSeededPublicRegistryGate.ts";
import { sha256Hex } from "../app/src/lib/garpa/sha256.ts";
import { buildCommonsSeededPublicRegistryRequest } from "../tests/fixtures/garpaCommonsSeededPublicRegistryFixture.ts";

const directory = "examples/garpa-commons-seeded-public-registry";
await mkdir(directory, { recursive: true });
const request = buildCommonsSeededPublicRegistryRequest();
const result = runCommonsSeededPublicRegistryGate(request);
if (!result.passed || !result.registryUpdateApplied || !result.ordinaryRegistryUpdate) {
  throw new Error(JSON.stringify(result, null, 2));
}
await writeFile(`${directory}/request.json`, `${JSON.stringify(request, null, 2)}\n`);
await writeFile(`${directory}/result.json`, `${JSON.stringify(result, null, 2)}\n`);
await writeFile(
  `${directory}/receipt.md`,
  renderCommonsSeededPublicRegistryMarkdown(request, result),
);
await writeFile(
  `${directory}/registry-entry.json`,
  `${JSON.stringify(result.nextEntry, null, 2)}\n`,
);
await writeFile(
  `${directory}/registry-entry.md`,
  renderRegistryUpdateMarkdown(result.ordinaryRegistryUpdate),
);
await writeFile(
  `${directory}/status.json`,
  `${JSON.stringify({
    passed: result.passed,
    state: result.state,
    registryUpdateApplied: result.registryUpdateApplied,
    registryState: result.registryState,
    requestDigest: sha256Hex(canonicalStringify(request)),
    resultDigest: computeCommonsSeededPublicRegistryResultDigest(result),
    currentEntryDigest: result.currentEntryDigest,
    nextEntryDigest: result.nextEntryDigest,
    releaseHistoryDigest: result.releaseHistoryDigest,
  }, null, 2)}\n`,
);
