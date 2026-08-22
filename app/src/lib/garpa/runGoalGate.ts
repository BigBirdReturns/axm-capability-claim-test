import type {
  BasisState,
  GoalGateResult,
  MissionOutcome,
} from "../../types/garpa";

const ADMISSIBLE_BASES: ReadonlySet<BasisState> = new Set([
  "explicitly_stated",
  "externally_supported",
  "derived",
]);

function valueAdmitted(value: MissionOutcome["operator"]): boolean {
  return Boolean(
    value.value?.trim() &&
      ADMISSIBLE_BASES.has(value.basis) &&
      value.evidenceCellIds.length > 0,
  );
}

export function runGoalGate(missionOutcome: MissionOutcome): GoalGateResult {
  const admittedFields: string[] = [];
  const missingFields: string[] = [];
  const blockingReasons: string[] = [];
  const pullList: string[] = [];

  const requireValue = (
    field: string,
    value: MissionOutcome["operator"],
    pull: string,
  ) => {
    if (valueAdmitted(value)) {
      admittedFields.push(field);
      return;
    }
    missingFields.push(field);
    blockingReasons.push(`Mission outcome unresolved: ${field}.`);
    pullList.push(pull);
  };

  requireValue(
    "operator",
    missionOutcome.operator,
    "Identify the operator or customer who owns the outcome and the authority boundary they operate under.",
  );
  requireValue(
    "protectedOrAffectedObject",
    missionOutcome.protectedOrAffectedObject,
    "Identify the exact object, population, site, process, or asset the capability must affect or protect.",
  );
  requireValue(
    "problemOrThreat",
    missionOutcome.problemOrThreat,
    "Define the problem or threat class, including material exclusions.",
  );
  requireValue(
    "desiredStateChange",
    missionOutcome.desiredStateChange,
    "State the observable change the customer is buying without naming the vendor architecture.",
  );
  requireValue(
    "operatingEnvironment",
    missionOutcome.operatingEnvironment,
    "Resolve the operating environment, geometry, conditions, duration, load, and constraints.",
  );
  requireValue(
    "timeAndCoverageRequirement",
    missionOutcome.timeAndCoverageRequirement,
    "Define the required time horizon, coverage boundary, concurrency, and availability window.",
  );
  requireValue(
    "baseline",
    missionOutcome.baseline,
    "Name the current process or incumbent comparator and preserve the measurement and accounting boundary.",
  );

  const admittedMetrics = missionOutcome.successMetrics.filter(
    (metric) =>
      metric.name.trim().length > 0 &&
      metric.threshold !== undefined &&
      ADMISSIBLE_BASES.has(metric.basis) &&
      metric.evidenceCellIds.length > 0,
  );
  if (admittedMetrics.length > 0) {
    admittedFields.push("successMetrics");
  } else {
    missingFields.push("successMetrics");
    blockingReasons.push(
      "Mission outcome unresolved: no evidence-bound falsifiable success metric with a threshold.",
    );
    pullList.push(
      "Define at least one customer-relevant metric, unit or category, comparator, and pass threshold before selecting an architecture.",
    );
  }

  const passed = missingFields.length === 0;
  let state: GoalGateResult["state"] = "admitted_for_architecture";
  if (!passed) {
    if (missingFields.length > 1) state = "goal_ambiguous";
    else if (missingFields[0] === "operatingEnvironment") {
      state = "environment_unresolved";
    } else if (missingFields[0] === "baseline") {
      state = "baseline_unresolved";
    } else if (missingFields[0] === "successMetrics") {
      state = "success_metric_missing";
    } else if (missingFields[0] === "timeAndCoverageRequirement") {
      state = "time_and_coverage_unresolved";
    } else {
      state = "goal_ambiguous";
    }
  }

  return {
    passed,
    state,
    admittedFields,
    missingFields,
    blockingReasons,
    pullList,
  };
}
