import { describe, expect, it } from "vitest";
import fixture from "../../examples/garpa-execution-receipts/execution-case.json";
import type { MissionEvaluationRequest } from "../../app/src/types/garpaExecution";
import { runMissionEvaluation } from "../../app/src/lib/garpa/runMissionEvaluation";
import { renderMissionEvaluationMarkdown } from "../../app/src/lib/garpa/renderMissionEvaluation";

function evaluationRequest(): MissionEvaluationRequest {
  return structuredClone(fixture.evaluationRequest) as unknown as MissionEvaluationRequest;
}

describe("GARPA mission evaluation renderer", () => {
  it("publishes the bounded state, excluded run, residual, and falsification line", () => {
    const evaluation = runMissionEvaluation(evaluationRequest());
    const markdown = renderMissionEvaluationMarkdown(evaluation);

    expect(markdown).toContain("# GARPA Mission Evaluation — GARPA-EXEC-0001");
    expect(markdown).toContain("Mission adequacy: bounded_match");
    expect(markdown).toContain("- run-valid-1");
    expect(markdown).toContain("- run-aborted-1");
    expect(markdown).toContain("does not establish full-mission or vendor-system equivalence");
    expect(markdown).toContain("## Falsification line");
  });
});
