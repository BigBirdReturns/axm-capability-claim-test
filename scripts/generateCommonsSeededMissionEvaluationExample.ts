import { mkdir, writeFile } from "node:fs/promises";
import { canonicalStringify } from "../app/src/lib/garpa/canonicalJson.ts";
import {
  computeCommonsSeededMissionEvaluationResultDigest,
} from "../app/src/lib/garpa/commonsSeededMissionEvaluationDigest.ts";
import { renderCommonsSeededMissionEvaluationMarkdown } from "../app/src/lib/garpa/renderCommonsSeededMissionEvaluation.ts";
import { runCommonsSeededMissionEvaluationGate } from "../app/src/lib/garpa/runCommonsSeededMissionEvaluationGate.ts";
import { sha256Hex } from "../app/src/lib/garpa/sha256.ts";
import { buildCommonsSeededMissionEvaluationRequest } from "../tests/fixtures/garpaCommonsSeededMissionEvaluationFixture.ts";

const directory = "examples/garpa-commons-seeded-mission-evaluation";
await mkdir(directory, { recursive: true });
const request = buildCommonsSeededMissionEvaluationRequest();
const result = runCommonsSeededMissionEvaluationGate(request);
if (!result.passed) throw new Error(JSON.stringify(result, null, 2));
const markdown = renderCommonsSeededMissionEvaluationMarkdown(request, result);
await writeFile(`${directory}/request.json`, `${JSON.stringify(request, null, 2)}\n`);
await writeFile(`${directory}/result.json`, `${JSON.stringify(result, null, 2)}\n`);
await writeFile(`${directory}/receipt.md`, markdown);
await writeFile(
  `${directory}/status.json`,
  `${JSON.stringify(
    {
      passed: result.passed,
      state: result.state,
      missionState: result.missionState,
      methodVersion: "1.2.0-commons-seeded-mission-evaluation",
      highestStage: "commons_seeded_mission_evaluation",
      requestDigest: sha256Hex(canonicalStringify(request)),
      resultDigest: computeCommonsSeededMissionEvaluationResultDigest(result),
      submittedRunCount: result.submittedRunIds.length,
      validRunCount: result.validRunIds.length,
      excludedRunCount: result.excludedRunIds.length,
      scenarioCoverage: result.scenarioCoverage,
      metricCoverage: result.metricCoverage,
    },
    null,
    2,
  )}\n`,
);
