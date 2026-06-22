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

export const SOURCING_THRESHOLD = 3;

import type { EvidenceClass } from "../types/audit";

export const EVIDENCE_CLASSES: EvidenceClass[] = [
  "confirmed",
  "reported",
  "derived",
  "judgment",
  "open",
];

export function fieldsForSet(fieldSet: "product" | "allocator" | "none"): FieldDef[] {
  if (fieldSet === "product") return PRODUCT_LOAD_BEARING;
  if (fieldSet === "allocator") return ALLOCATOR_LOAD_BEARING;
  return [];
}
