import { mkdir, writeFile } from "node:fs/promises";
import { canonicalStringify } from "../app/src/lib/garpa/canonicalJson.ts";
import { renderCommonsSeededMissionEvaluationMarkdown } from "../app/src/lib/garpa/renderCommonsSeededMissionEvaluation.ts";
import { runCommonsSeededMissionEvaluationGate } from "../app/src/lib/garpa/runCommonsSeededMissionEvaluationGate.ts";
import { sha256Hex } from "../app/src/lib/garpa/sha256.ts";
import { buildSeededMissionEvaluationRequest } from "../tests/fixtures/garpaCommonsSeededMissionEvaluationFixture.ts";

const directory = "examples/garpa-commons-seeded-mission-evaluation";
await mkdir(directory, { recursive: true });
const request = buildSeededMissionEvaluationRequest();
const result = runCommonsSeededMissionEvaluationGate(request);
if (!result.passed) throw new Error(JSON.stringify(result, null, 2));
const markdown = renderCommonsSeededMissionEvaluationMarkdown(request, result);
await writeFile(`${directory}/request.json`, `${JSON.stringify(request, null, 2)}\n`);
await writeFile(`${directory}/result.json`, `${JSON.stringify(result, null, 2)}\n`);
await writeFile(`${directory}/receipt.md`, markdown);
await writeFile(
  `${directory}/status.json`,
  `${JSON.stringify({
    passed: result.passed,
    state: result.state,
    disposition: result.disposition,
    requestDigest: sha256Hex(canonicalStringify(request)),
    resultDigest: sha256Hex(canonicalStringify(result)),
    runCount: result.runSummaries.length,
    scenarioCoverage: result.scenarioCoverage,
    metricCoverage: result.metricCoverage,
  }, null, 2)}\n`,
);
