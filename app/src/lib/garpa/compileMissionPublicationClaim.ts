import type {
  MissionPublicationInput,
  PublicationClaim,
} from "../../types/garpaPublication";

function sentence(input: MissionPublicationInput): string {
  const { evaluation, subject } = input;
  if (evaluation.state === "matched") {
    return `Under the frozen full mission boundary, ${subject} satisfied every required scenario and essential metric.`;
  }
  if (evaluation.state === "bounded_match") {
    return `Under the frozen scenarios and bounded mission slice, ${subject} satisfied every required scenario and essential metric.`;
  }
  if (evaluation.state === "failed") {
    return `Under the frozen scenarios, ${subject} failed at least one essential mission metric.`;
  }
  if (evaluation.state === "partial") {
    return `The current test record partially assesses ${subject}; at least one required scenario or essential metric remains unresolved.`;
  }
  if (evaluation.state === "incomparable") {
    return `The available test record for ${subject} is not comparable to the frozen build and qualification boundary.`;
  }
  return `No valid current test record establishes mission adequacy for ${subject}.`;
}

export function compileMissionPublicationClaim(
  input: MissionPublicationInput,
): PublicationClaim {
  const supported = input.evaluation.state !== "unassessed";
  const bounded = input.evaluation.state === "bounded_match";
  const unresolved =
    input.evaluation.state === "partial" ||
    input.evaluation.state === "incomparable" ||
    input.evaluation.state === "unassessed";

  return {
    id: "mission-evaluation",
    caseId: input.evaluation.caseId,
    text: sentence(input),
    claimClass: unresolved ? "open_question" : "mission_evaluation",
    subject: input.subject,
    scope: {
      buildDigest: input.evaluation.evaluatedBuildDigest,
      scenarioIds: input.scenarioIds,
      metricIds: input.metricIds,
      environment: input.evaluation.boundaryDescription,
    },
    supportRefs: supported
      ? [
          {
            relation: "evaluated_by",
            evaluationDigest: input.evaluationDigest,
            note: "Mission evaluation produced from admitted, current test-run receipts.",
          },
        ]
      : [],
    limitations: [
      ...input.evaluation.residuals,
      ...input.evaluation.incomparableDimensions,
    ],
    prohibitedGeneralizations: bounded
      ? [
          "Does not establish performance outside the stated bounded mission slice.",
          "Does not establish operational field equivalence.",
          "Does not establish vendor-system parity.",
        ]
      : input.evaluation.state === "matched"
        ? ["Does not establish vendor-system parity without a same-fixture vendor comparison."]
        : ["Does not support a claim of mission adequacy."],
    state: supported ? "supported" : "blocked",
  };
}
