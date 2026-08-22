import type {
  EvidenceCell,
  EvidenceControl,
  EvidenceTarget,
  OfferingClaimField,
} from "../types/garpa";

export const OFFERING_FIELD_TARGETS: Record<
  OfferingClaimField,
  readonly EvidenceTarget[]
> = {
  offering_identity: ["offering_identity", "claim_was_made"],
  offering_version: ["offering_version", "claim_was_made"],
  advertised_outcome: ["claim_was_made"],
  claimed_mechanism: ["claim_was_made", "system_boundary"],
  advertised_economics: ["claim_was_made"],
  named_operator_need: ["operator_need"],
  deployment_record: ["deployment_occurred"],
  measured_performance: ["performance_observed", "local_result"],
  economic_baseline: ["cost_observed"],
  operating_environment: [
    "operator_need",
    "performance_observed",
    "system_boundary",
    "local_result",
  ],
  system_boundary: ["system_boundary"],
  independent_verification: ["performance_observed", "local_result"],
  ownership_and_lock_in: ["ownership_or_lock_in", "system_boundary", "claim_was_made"],
};

const EXTERNAL_PERFORMANCE_CONTROLS: ReadonlySet<EvidenceControl> = new Set([
  "independent",
  "local_measured",
]);

const EXTERNAL_ATTRIBUTION_CONTROLS: ReadonlySet<EvidenceControl> = new Set([
  "externally_attributed",
  "independent",
  "local_measured",
]);

export function evidenceCellSupportsField(
  field: OfferingClaimField,
  cell: EvidenceCell,
): boolean {
  if (!OFFERING_FIELD_TARGETS[field].includes(cell.target)) return false;

  // Claimant-controlled prose may establish that a statement was made. It may
  // not establish measured performance, independent verification, deployment,
  // an operator-owned requirement, or a comparator cost baseline.
  if (
    (field === "measured_performance" || field === "independent_verification") &&
    !EXTERNAL_PERFORMANCE_CONTROLS.has(cell.control)
  ) {
    return false;
  }

  if (
    (field === "deployment_record" ||
      field === "named_operator_need" ||
      field === "economic_baseline") &&
    !EXTERNAL_ATTRIBUTION_CONTROLS.has(cell.control)
  ) {
    return false;
  }

  if (field === "independent_verification" && cell.control !== "independent") {
    return false;
  }

  return true;
}

export const CLAIMANT_ONLY_FIELDS: ReadonlySet<OfferingClaimField> = new Set([
  "advertised_outcome",
  "claimed_mechanism",
  "advertised_economics",
]);
