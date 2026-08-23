import type {
  PublicationClaim,
  PublicationCompilationInput,
} from "../../types/garpaPublication";

function missionClaim(input: PublicationCompilationInput): PublicationClaim {
  const common = {
    id: "pub-mission-1",
    caseId: input.caseId,
    claimClass: "mission_evaluation" as const,
    subject: input.subject,
    scope: {
      offeringVersion: input.offeringVersion,
      buildDigest: input.missionBuildDigest,
      scenarioIds: input.missionScenarioIds,
      metricIds: input.missionMetricIds,
    },
    supportRefs: [
      {
        relation: "evaluated_by" as const,
        evaluationDigest: input.missionEvaluationDigest,
        note: "Frozen GARPA mission evaluation.",
      },
      ...input.missionRunReceiptIds.map((runReceiptId) => ({
        relation: "measured_by" as const,
        runReceiptId,
        note: "Admitted test-run receipt used by the mission evaluation.",
      })),
    ],
    limitations: [...input.missionResiduals],
    prohibitedGeneralizations: [
      "Do not generalize beyond the frozen scenarios, metrics, environment, build, or qualification contract.",
      "Do not convert a bounded mission result into unrestricted product-level or operational equivalence.",
    ],
    state: "candidate" as const,
  };

  switch (input.missionEvaluationState) {
    case "matched":
      return {
        ...common,
        text: `Under the frozen scenarios and metrics, GARPA build ${input.missionBuildDigest} satisfied the admitted mission outcome.`,
      };
    case "bounded_match":
      return {
        ...common,
        text: `Under the frozen bounded scenarios and metrics, GARPA build ${input.missionBuildDigest} satisfied the evaluated mission slice.`,
      };
    case "failed":
      return {
        ...common,
        text: `GARPA build ${input.missionBuildDigest} failed at least one essential metric under the frozen qualification contract.`,
      };
    case "partial":
      return {
        ...common,
        text: `GARPA build ${input.missionBuildDigest} produced a partial mission evaluation because required scenario, metric, repetition, or conclusiveness conditions remain unresolved.`,
      };
    case "incomparable":
      return {
        ...common,
        text: `The available run receipts cannot be compared under the frozen build and qualification contract.`,
      };
    case "unassessed":
      return {
        ...common,
        text: `GARPA has not yet completed a receipted mission evaluation for build ${input.missionBuildDigest}.`,
      };
  }
}

function residualClaims(input: PublicationCompilationInput): PublicationClaim[] {
  return input.missionResiduals.map((residual, index) => ({
    id: `pub-residual-${index + 1}`,
    caseId: input.caseId,
    text: residual,
    claimClass: "residual",
    subject: input.subject,
    scope: {
      offeringVersion: input.offeringVersion,
      buildDigest: input.missionBuildDigest,
      scenarioIds: input.missionScenarioIds,
      metricIds: input.missionMetricIds,
    },
    supportRefs: [
      {
        relation: "limited_by",
        evaluationDigest: input.missionEvaluationDigest,
        note: "Residual carried from the mission evaluation.",
      },
    ],
    limitations: [],
    prohibitedGeneralizations: [
      "Do not omit this residual from any release that carries the associated mission claim.",
    ],
    state: "candidate",
  }));
}

function parityClaim(input: PublicationCompilationInput): PublicationClaim | undefined {
  if (!input.vendorParityDigest || !input.vendorParityState || !input.vendorOffering) {
    return undefined;
  }

  if (input.vendorParityState === "same_fixture_match") {
    return {
      id: "pub-parity-1",
      caseId: input.caseId,
      text: `Against ${input.vendorOffering} version ${input.vendorVersion ?? "unresolved"}, GARPA matched the required metrics ${(
        input.matchedParityMetricIds ?? []
      ).join(", ")} under the same frozen fixture and measurement method.`,
      claimClass: "vendor_parity",
      subject: input.vendorOffering,
      scope: {
        offeringVersion: input.vendorVersion,
        buildDigest: input.missionBuildDigest,
        scenarioIds: input.missionScenarioIds,
        metricIds: input.matchedParityMetricIds ?? [],
      },
      supportRefs: [
        {
          relation: "evaluated_by",
          evaluationDigest: input.vendorParityDigest,
          note: "Exact-version vendor parity evaluation.",
        },
      ],
      limitations: [
        input.parityScopeBoundary ??
          "Parity is confined to the exact versions, fixture, method, metrics, and accounting boundary evaluated.",
      ],
      prohibitedGeneralizations: [
        "Do not claim unrestricted full-system, field, operational, or lifecycle equivalence.",
        "Do not extend parity to unmeasured metrics or other vendor versions.",
      ],
      state: "candidate",
    };
  }

  return {
    id: "pub-parity-residual-1",
    caseId: input.caseId,
    text: `Vendor parity with ${input.vendorOffering} was not established; the governed parity state is ${input.vendorParityState}.`,
    claimClass: "residual",
    subject: input.vendorOffering,
    scope: {
      offeringVersion: input.vendorVersion,
      buildDigest: input.missionBuildDigest,
      scenarioIds: input.missionScenarioIds,
      metricIds: input.matchedParityMetricIds ?? [],
    },
    supportRefs: [
      {
        relation: "evaluated_by",
        evaluationDigest: input.vendorParityDigest,
        note: "Vendor parity evaluation preserving the blocked or negative state.",
      },
    ],
    limitations: [
      input.parityScopeBoundary ??
        "No general product-level equivalence claim is supported.",
    ],
    prohibitedGeneralizations: [
      "Do not describe a blocked, missing, evidence-only, mismatched, or negative comparison as parity.",
    ],
    state: "candidate",
  };
}

export function compilePublicationClaims(
  input: PublicationCompilationInput,
): PublicationClaim[] {
  const parity = parityClaim(input);
  return [
    missionClaim(input),
    ...residualClaims(input),
    ...(parity ? [parity] : []),
  ];
}
