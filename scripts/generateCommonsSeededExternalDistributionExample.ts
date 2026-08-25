import { mkdir, writeFile } from "node:fs/promises";
import { canonicalStringify } from "../app/src/lib/garpa/canonicalJson.ts";
import { computeCommonsSeededExternalDistributionResultDigest } from "../app/src/lib/garpa/commonsSeededExternalDistributionDigest.ts";
import { renderCommonsSeededExternalDistributionMarkdown } from "../app/src/lib/garpa/renderCommonsSeededExternalDistribution.ts";
import { runCommonsSeededExternalDistributionGate } from "../app/src/lib/garpa/runCommonsSeededExternalDistributionGate.ts";
import { sha256Hex } from "../app/src/lib/garpa/sha256.ts";
import { buildCommonsSeededExternalDistributionRequest } from "../tests/fixtures/garpaCommonsSeededExternalDistributionFixture.ts";

const directory =
  "examples/garpa-commons-seeded-external-distribution";
await mkdir(directory, { recursive: true });
const request =
  buildCommonsSeededExternalDistributionRequest();
const result =
  runCommonsSeededExternalDistributionGate(request);
if (
  !result.passed ||
  result.eventObserved ||
  result.publicReleaseOccurred ||
  result.publicRegistryPublished
) {
  throw new Error(JSON.stringify(result, null, 2));
}
await writeFile(
  `${directory}/request.json`,
  `${JSON.stringify(request, null, 2)}\n`,
);
await writeFile(
  `${directory}/result.json`,
  `${JSON.stringify(result, null, 2)}\n`,
);
await writeFile(
  `${directory}/receipt.md`,
  renderCommonsSeededExternalDistributionMarkdown(
    request,
    result,
  ),
);
await writeFile(
  `${directory}/status.json`,
  `${JSON.stringify(
    {
      passed: result.passed,
      state: result.state,
      mode: result.mode,
      receiptAdmitted: result.receiptAdmitted,
      eventObserved: result.eventObserved,
      publicReleaseOccurred: result.publicReleaseOccurred,
      publicRegistryPublished: result.publicRegistryPublished,
      requestDigest: sha256Hex(canonicalStringify(request)),
      resultDigest:
        computeCommonsSeededExternalDistributionResultDigest(
          result,
        ),
      observationDigest:
        result.distributionObservationDigest,
      observedFileSetDigest: result.observedFileSetDigest,
      evidenceArtifactSetDigest:
        result.evidenceArtifactSetDigest,
    },
    null,
    2,
  )}\n`,
);
