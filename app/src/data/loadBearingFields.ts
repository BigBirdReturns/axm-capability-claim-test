import type { EvidenceClass } from "../types/audit";
import type { FieldSet } from "./objectRoutes";

export interface FieldDef {
  field: string;
  label: string;
}

// Product-company load-bearing fields (Field Card, Step 1).
export const PRODUCT_LOAD_BEARING: FieldDef[] = [
  { field: "capital_raised", label: "Capital raised" },
  { field: "valuation", label: "Valuation" },
  { field: "competed_awards", label: "Competed awards" },
  { field: "named_customer", label: "Named customer" },
  { field: "performance_baseline", label: "Performance baseline" },
  { field: "independent_verification", label: "Independent verification" },
  { field: "production_status", label: "Production status" },
  { field: "ownership_posture", label: "Ownership posture" },
];

// Capital-allocator load-bearing fields — attribution, not product.
export const ALLOCATOR_LOAD_BEARING: FieldDef[] = [
  { field: "fund_size", label: "Fund size" },
  { field: "lp_category", label: "LP category" },
  { field: "portfolio", label: "Portfolio" },
  { field: "lead_investor_status", label: "Lead-investor status" },
  { field: "board_role", label: "Board role" },
  { field: "entry_timing", label: "Entry timing" },
  { field: "follow_on_outcomes", label: "Follow-on outcomes" },
  { field: "founder_validation", label: "Founder validation" },
  { field: "attributable_wins", label: "Attributable wins" },
];

// Generic offering fields. Advertised claims remain separate from evidence that
// a deployment occurred, performance was measured, or the economics share a
// complete accounting boundary.
export const OFFERING_LOAD_BEARING: FieldDef[] = [
  { field: "offering_identity", label: "Offering identity" },
  { field: "offering_version", label: "Offering version" },
  { field: "advertised_outcome", label: "Advertised customer outcome" },
  { field: "claimed_mechanism", label: "Claimed mechanism" },
  { field: "advertised_economics", label: "Advertised economics" },
  { field: "named_operator_need", label: "Named operator need" },
  { field: "deployment_record", label: "Deployment record" },
  { field: "measured_performance", label: "Measured performance" },
  { field: "economic_baseline", label: "Economic baseline" },
  { field: "operating_environment", label: "Operating environment" },
  { field: "system_boundary", label: "Complete system boundary" },
  { field: "independent_verification", label: "Independent verification" },
  { field: "ownership_and_lock_in", label: "Ownership and lock-in" },
];

// Frontier-model load-bearing fields — the capability axes a frontier delta is
// claimed on. Each field is a claim of headroom over a NAMED lesser baseline;
// the sourcing gate treats "the vendor said so at launch" exactly like any
// other unsourced field.
export const FRONTIER_LOAD_BEARING: FieldDef[] = [
  { field: "benchmark_delta", label: "Benchmark delta" },
  { field: "reasoning_depth", label: "Reasoning depth" },
  { field: "long_horizon_agency", label: "Long-horizon agency" },
  { field: "context_capacity", label: "Context capacity" },
  { field: "tool_orchestration", label: "Tool orchestration" },
  { field: "multimodal_range", label: "Multimodal range" },
  { field: "instruction_reliability", label: "Instruction reliability" },
  { field: "novel_synthesis", label: "Novel synthesis" },
  { field: "cost_latency_profile", label: "Cost / latency profile" },
];

export const SOURCING_THRESHOLD = 3;

export const EVIDENCE_CLASSES: EvidenceClass[] = [
  "confirmed",
  "reported",
  "derived",
  "judgment",
  "open",
];

export function fieldsForSet(fieldSet: FieldSet): FieldDef[] {
  if (fieldSet === "product") return PRODUCT_LOAD_BEARING;
  if (fieldSet === "allocator") return ALLOCATOR_LOAD_BEARING;
  if (fieldSet === "offering") return OFFERING_LOAD_BEARING;
  if (fieldSet === "frontier") return FRONTIER_LOAD_BEARING;
  return [];
}
