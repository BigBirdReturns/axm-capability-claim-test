import type {
  MissionEvaluation,
  MissionEvaluationInput,
} from "../../types/garpaEvaluation";
import { evaluateMissionAdequacy } from "./evaluateMissionAdequacy";

// Stable wrapper for callers that require the current mission-evaluation
// contract. It keeps future policy additions from changing the direct evaluator
// import surface across the CLI, MCP server, and tests.
export function evaluateMissionAdequacyStrict(
  input: MissionEvaluationInput,
): MissionEvaluation {
  return evaluateMissionAdequacy(input);
}
