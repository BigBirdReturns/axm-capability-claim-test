import { mkdir, writeFile } from "node:fs/promises";
import { canonicalStringify } from "../app/src/lib/garpa/canonicalJson.ts";
import { computeCommonsSeededVendorParityResultDigest } from "../app/src/lib/garpa/commonsSeededVendorParityDigest.ts";
import { renderCommonsSeededVendorParityMarkdown } from "../app/src/lib/garpa/renderCommonsSeededVendorParity.ts";
import { runCommonsSeededVendorParityGate } from "../app/src/lib/garpa/runCommonsSeededVendorParityGate.ts";
import { sha256Hex } from "../app/src/lib/garpa/sha256.ts";
import { buildCommonsSeededVendorParityRequest } from "../tests/fixtures/garpaCommonsSeededVendorParityFixture.ts";

const directory = "examples/garpa-commons-seeded-vendor-parity";
await mkdir(directory, { recursive: true });
const request = buildCommonsSeededVendorParityRequest();
const result = runCommonsSeededVendorParityGate(request);
if (!result.passed) throw new Error(JSON.stringify(result, null, 2));
await writeFile(`${directory}/request.json`, `${JSON.stringify(request, null, 2)}\n`);
await writeFile(`${directory}/result.json`, `${JSON.stringify(result, null, 2)}\n`);
await writeFile(
  `${directory}/receipt.md`,
  renderCommonsSeededVendorParityMarkdown(request, result),
);
await writeFile(
  `${directory}/status.json`,
  `${JSON.stringify({
    passed: result.passed,
    state: result.state,
    parityState: result.parityState,
    requestDigest: sha256Hex(canonicalStringify(request)),
    resultDigest: computeCommonsSeededVendorParityResultDigest(result),
    garpaObservationSetDigest: result.garpaObservationSetDigest,
    vendorObservationSetDigest: result.vendorObservationSetDigest,
  }, null, 2)}\n`,
);
