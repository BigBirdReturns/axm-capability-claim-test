import type {
  MetricParityResult,
  ParityMetricComparator,
  ParityMetricObservation,
  ScenarioComparison,
  VendorParityEvaluation,
  VendorParityRequest,
} from "../../types/garpaParity";

const MEASURED_CONTROLS = new Set(["independent", "local_measured"]);

function observationsFor(
  request: VendorParityRequest,
  subject: "garpa" | "vendor",
  metricId: string,
): ParityMetricObservation[] {
  return request.observations.filter(
    (item) => item.subject === subject && item.metricId === metricId,
  );
}

function sameFixtureComparison(
  comparisons: ScenarioComparison[],
  garpaScenarioId: string,
  vendorScenarioId: string,
): ScenarioComparison | undefined {
  return comparisons.find(
    (item) =>
      item.garpaScenarioId === garpaScenarioId &&
      item.vendorScenarioId === vendorScenarioId &&
      item.state === "same_fixture",
  );
}

function valuesComparable(
  comparator: ParityMetricComparator,
  garpa: ParityMetricObservation,
  vendor: ParityMetricObservation,
): string | null {
  if (!MEASURED_CONTROLS.has(vendor.evidenceControl)) {
    return "Vendor observation is not independent or locally measured evidence.";
  }
  if (!garpa.fixtureDigest || !vendor.fixtureDigest) {
    return "Same-fixture parity requires both fixture digests.";
  }
  if (garpa.fixtureDigest !== vendor.fixtureDigest) {
    return "Fixture digests differ.";
  }
  if (!garpa.methodDigest || !vendor.methodDigest) {
    return "Same-fixture parity requires both measurement-method digests.";
  }
  if (garpa.methodDigest !== vendor.methodDigest) {
    return "Measurement-method digests differ.";
  }
  if (comparator.requiredUnit) {
    if (garpa.unit !== comparator.requiredUnit || vendor.unit !== comparator.requiredUnit) {
      return `Both observations must use ${comparator.requiredUnit}.`;
    }
  }
  if (
    ["higher_is_better", "lower_is_better", "absolute_delta"].includes(
      comparator.direction,
    ) &&
    (typeof garpa.value !== "number" || typeof vendor.value !== "number")
  ) {
    return "Numeric parity comparison requires numeric observations.";
  }
  if (
    comparator.direction === "boolean_equal" &&
    (typeof garpa.value !== "boolean" || typeof vendor.value !== "boolean")
  ) {
    return "Boolean parity comparison requires boolean observations.";
  }
  if (
    comparator.direction === "categorical_equal" &&
    (typeof garpa.value !== "string" || typeof vendor.value !== "string")
  ) {
    return "Categorical parity comparison requires string observations.";
  }
  return null;
}

function compareValues(
  comparator: ParityMetricComparator,
  garpaValue: number | string | boolean,
  vendorValue: number | string | boolean,
): { match: boolean; tolerance?: number } {
  if (
    comparator.direction === "boolean_equal" ||
    comparator.direction === "categorical_equal"
  ) {
    return { match: garpaValue === vendorValue };
  }

  const garpa = garpaValue as number;
  const vendor = vendorValue as number;
  const tolerance =
    (comparator.absoluteTolerance ?? 0) +
    Math.abs(vendor) * (comparator.relativeTolerance ?? 0);

  if (comparator.direction === "higher_is_better") {
    return { match: garpa + tolerance >= vendor, tolerance };
  }
  if (comparator.direction === "lower_is_better") {
    return { match: garpa - tolerance <= vendor, tolerance };
  }
  return { match: Math.abs(garpa - vendor) <= tolerance, tolerance };
}

function evaluateMetric(
  request: VendorParityRequest,
  comparator: ParityMetricComparator,
): MetricParityResult {
  const garpaObservations = observationsFor(request, "garpa", comparator.metricId);
  const vendorObservations = observationsFor(request, "vendor", comparator.metricId);

  if (garpaObservations.length === 0) {
    return {
      metricId: comparator.metricId,
      label: comparator.label,
      essential: comparator.essential,
      state: "missing",
      reason: "No GARPA observation exists for the required metric.",
    };
  }
  if (vendorObservations.length === 0) {
    return {
      metricId: comparator.metricId,
      label: comparator.label,
      essential: comparator.essential,
      state: "missing",
      reason: "No vendor observation exists for the required metric.",
    };
  }

  const candidatePairs = garpaObservations.flatMap((garpa) =>
    vendorObservations.flatMap((vendor) =>
      sameFixtureComparison(
        request.scenarioComparisons,
        garpa.scenarioId,
        vendor.scenarioId,
      )
        ? [{ garpa, vendor }]
        : [],
    ),
  );

  if (candidatePairs.length === 0) {
    return {
      metricId: comparator.metricId,
      label: comparator.label,
      essential: comparator.essential,
      state: "incomparable",
      reason: "No same-fixture scenario pair exists for the metric observations.",
    };
  }

  const incompatibilities: string[] = [];
  for (const pair of candidatePairs) {
    const incompatibility = valuesComparable(comparator, pair.garpa, pair.vendor);
    if (incompatibility) {
      incompatibilities.push(incompatibility);
      continue;
    }
    const comparison = compareValues(
      comparator,
      pair.garpa.value,
      pair.vendor.value,
    );
    return {
      metricId: comparator.metricId,
      label: comparator.label,
      essential: comparator.essential,
      state: comparison.match ? "match" : "miss",
      garpaObservationId: pair.garpa.id,
      vendorObservationId: pair.vendor.id,
      garpaValue: pair.garpa.value,
      vendorValue: pair.vendor.value,
      unit: comparator.requiredUnit,
      allowedTolerance: comparison.tolerance,
      reason: comparison.match
        ? "GARPA matches the vendor observation under the same fixture and method within the admitted tolerance."
        : "GARPA does not match the vendor observation under the same fixture and method within the admitted tolerance.",
    };
  }

  return {
    metricId: comparator.metricId,
    label: comparator.label,
    essential: comparator.essential,
    state: "incomparable",
    reason: Array.from(new Set(incompatibilities)).join(" "),
  };
}

function resolutionFor(state: VendorParityEvaluation["state"]): string {
  switch (state) {
    case "vendor_baseline_missing":
      return "Provide exact-version vendor measurements with source artifacts, fixture, method, scenario, and metric custody.";
    case "evidence_only_comparison":
      return "Run or obtain an independent same-fixture measurement of the exact vendor configuration.";
    case "scenario_mismatch":
      return "Exercise both systems under the same frozen scenario, fixture, and measurement method.";
    case "accounting_boundary_mismatch":
      return "Align currency, evaluation period, mission denominator, labor, sustainment, qualification, and all material cost categories.";
    case "incomparable":
      return "Resolve the missing metric, unit, fixture digest, method digest, version, or measurement custody identified in the metric results.";
    case "same_fixture_miss":
      return "A corrected GARPA build must match every missed required metric under the unchanged same-fixture contract.";
    case "same_fixture_match":
      return "A valid same-fixture repeat that misses any required metric would overturn the parity result.";
    case "not_attempted":
      return "Complete a matched or bounded-match GARPA mission evaluation before attempting vendor parity.";
  }
}

export function runVendorParityEvaluation(
  request: VendorParityRequest,
): VendorParityEvaluation {
  const vendorObservations = request.observations.filter(
    (item) => item.subject === "vendor",
  );
  const hasMeasuredVendorEvidence = vendorObservations.some((item) =>
    MEASURED_CONTROLS.has(item.evidenceControl),
  );
  const hasReportedOnlyScenario = request.scenarioComparisons.some(
    (item) => item.state === "reported_only",
  );
  const hasSameFixtureScenario = request.scenarioComparisons.some(
    (item) => item.state === "same_fixture",
  );
  const requiresAccountingAlignment = request.comparators.some(
    (item) => item.requiresAccountingAlignment,
  );
  const accountingAligned =
    request.accountingComparison?.state === "aligned";

  let state: VendorParityEvaluation["state"];
  let metricResults: MetricParityResult[] = [];

  if (![
    "matched",
    "bounded_match",
  ].includes(request.garpaMissionState)) {
    state = "not_attempted";
  } else if (!request.vendorVersion?.trim() || vendorObservations.length === 0) {
    state = "vendor_baseline_missing";
  } else if (!hasMeasuredVendorEvidence || hasReportedOnlyScenario) {
    state = "evidence_only_comparison";
  } else if (!hasSameFixtureScenario) {
    state = "scenario_mismatch";
  } else if (requiresAccountingAlignment && !accountingAligned) {
    state = "accounting_boundary_mismatch";
  } else {
    metricResults = request.comparators.map((comparator) =>
      evaluateMetric(request, comparator),
    );
    const incomparable = metricResults.some(
      (result) => result.state === "missing" || result.state === "incomparable",
    );
    const missed = metricResults.some((result) => result.state === "miss");
    state = incomparable
      ? "incomparable"
      : missed
        ? "same_fixture_miss"
        : "same_fixture_match";
  }

  const matchedMetricIds = metricResults
    .filter((result) => result.state === "match")
    .map((result) => result.metricId);
  const missedMetricIds = metricResults
    .filter((result) => result.state === "miss")
    .map((result) => result.metricId);
  const incomparableMetricIds = metricResults
    .filter(
      (result) => result.state === "missing" || result.state === "incomparable",
    )
    .map((result) => result.metricId);

  const supportedParityClaims = metricResults
    .filter((result) => result.state === "match")
    .map(
      (result) =>
        `${result.label} matched the exact-version vendor observation under the same fixture and method within the admitted tolerance.`,
    );
  const unsupportedParityClaims = metricResults
    .filter((result) => result.state !== "match")
    .map((result) => `${result.label}: ${result.reason}`);

  if (request.garpaMissionState === "bounded_match") {
    unsupportedParityClaims.push(
      "The comparison does not establish full-mission or unrestricted product-level equivalence outside the frozen GARPA boundary.",
    );
  }
  if (state !== "same_fixture_match") {
    unsupportedParityClaims.push(
      `A general claim that GARPA equals ${request.vendorOffering} is not supported by this evaluation.`,
    );
  }

  const firstGap =
    metricResults.find(
      (result) => result.essential && result.state !== "match",
    ) ?? metricResults.find((result) => result.state !== "match");
  const largestGap = firstGap
    ? `${firstGap.label}: ${firstGap.reason}`
    : state === "same_fixture_match"
      ? "No required same-fixture metric gap remains inside the evaluated boundary."
      : resolutionFor(state);

  const scopeBoundary =
    request.garpaMissionState === "bounded_match"
      ? "Parity, when supported, is confined to the frozen bounded mission evaluation, exact vendor version, same fixture, same method, required metrics, and aligned accounting boundary where cost is compared."
      : "Parity, when supported, is confined to the exact vendor version, frozen GARPA build and qualification digests, same fixture, same method, required metrics, and aligned accounting boundary where cost is compared.";

  return {
    caseId: request.caseId,
    vendorOffering: request.vendorOffering,
    vendorVersion: request.vendorVersion,
    garpaBuildReceiptDigest: request.garpaBuildReceiptDigest,
    garpaQualificationContractDigest: request.garpaQualificationContractDigest,
    state,
    metricResults,
    matchedMetricIds,
    missedMetricIds,
    incomparableMetricIds,
    supportedParityClaims,
    unsupportedParityClaims,
    largestGap,
    whatWouldResolveIt: resolutionFor(state),
    scopeBoundary,
    falsificationLine:
      state === "same_fixture_match"
        ? "Repeat the same fixture and method against either exact configuration. Any valid miss on a required metric overturns the parity result."
        : "Only an exact-version, independently measured, same-fixture comparison under the frozen metric and accounting contracts can advance this state.",
  };
}
