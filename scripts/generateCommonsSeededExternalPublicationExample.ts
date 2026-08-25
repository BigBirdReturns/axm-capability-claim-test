import { mkdir, writeFile } from "node:fs/promises";
import { canonicalStringify } from "../app/src/lib/garpa/canonicalJson.ts";
import { computeCommonsSeededExternalPublicationResultDigest } from "../app/src/lib/garpa/commonsSeededExternalPublicationDigest.ts";
import { renderCommonsSeededExternalPublicationMarkdown } from "../app/src/lib/garpa/renderCommonsSeededExternalPublication.ts";
import { runCommonsSeededExternalPublicationGate } from "../app/src/lib/garpa/runCommonsSeededExternalPublicationGate.ts";
import { sha256Hex } from "../app/src/lib/garpa/sha256.ts";
import { buildCommonsSeededExternalPublicationRequest } from "../tests/fixtures/garpaCommonsSeededExternalPublicationFixture.ts";

const directory = "examples/garpa-commons-seeded-external-publication";
await mkdir(directory, { recursive: true });
const request = buildCommonsSeededExternalPublicationRequest();
const result = runCommonsSeededExternalPublicationGate(request);
if (!result.passed || !result.receiptAdmitted) {
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
  renderCommonsSeededExternalPublicationMarkdown(request, result),
);
await writeFile(
  `${directory}/status.json`,
  `${JSON.stringify(
    {
      passed: result.passed,
      state: result.state,
      receiptAdmitted: result.receiptAdmitted,
      evidenceClass: result.evidenceClass,
      eventKind: result.eventKind,
      externalEventObserved: result.externalEventObserved,
      syntheticQualificationOnly: result.syntheticQualificationOnly,
      publicRegistryPublished: result.publicRegistryPublished,
      publicReleaseOccurred: result.publicReleaseOccurred,
      requestDigest: sha256Hex(canonicalStringify(request)),
      resultDigest:
        computeCommonsSeededExternalPublicationResultDigest(result),
      registryEntryDigest: result.registryEntryDigest,
      receiptDigest: result.externalPublicationReceiptDigest,
      artifactSetDigest: result.externalArtifactSetDigest,
    },
    null,
    2,
  )}\n`,
);
