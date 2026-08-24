import { mkdir, writeFile } from "node:fs/promises";
import { canonicalStringify } from "../app/src/lib/garpa/canonicalJson.ts";
import { computeCommonsSeededPublicationResultDigest } from "../app/src/lib/garpa/commonsSeededPublicationDigest.ts";
import { renderCommonsSeededPublicationMarkdown } from "../app/src/lib/garpa/renderCommonsSeededPublication.ts";
import { renderPublicDossier } from "../app/src/lib/garpa/renderPublicDossier.ts";
import { runCommonsSeededPublicationGate } from "../app/src/lib/garpa/runCommonsSeededPublicationGate.ts";
import { sha256Hex } from "../app/src/lib/garpa/sha256.ts";
import { buildCommonsSeededPublicationRequest } from "../tests/fixtures/garpaCommonsSeededPublicationFixture.ts";

const directory = "examples/garpa-commons-seeded-publication";
await mkdir(directory, { recursive: true });
const request = buildCommonsSeededPublicationRequest();
const result = runCommonsSeededPublicationGate(request);
if (!result.passed || !result.ordinaryPublicationGate) {
  throw new Error(JSON.stringify(result, null, 2));
}
await writeFile(`${directory}/request.json`, `${JSON.stringify(request, null, 2)}\n`);
await writeFile(`${directory}/result.json`, `${JSON.stringify(result, null, 2)}\n`);
await writeFile(
  `${directory}/receipt.md`,
  renderCommonsSeededPublicationMarkdown(request, result),
);
await writeFile(
  `${directory}/public-dossier.md`,
  renderPublicDossier(
    request.publicationPackage,
    result.ordinaryPublicationGate,
  ),
);
await writeFile(
  `${directory}/status.json`,
  `${JSON.stringify({
    passed: result.passed,
    state: result.state,
    publicationReady: result.publicationReady,
    publicationState: result.publicationState,
    requestDigest: sha256Hex(canonicalStringify(request)),
    resultDigest: computeCommonsSeededPublicationResultDigest(result),
    claimSetDigest: result.claimSetDigest,
    upstreamDigestSetDigest: result.upstreamDigestSetDigest,
  }, null, 2)}\n`,
);
