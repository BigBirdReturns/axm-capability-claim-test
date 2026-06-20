export interface SeamDef {
  id: string;
  question: string;
}

// Step 5. The seams (product company). Ten forced questions.
export const PRODUCT_SEAMS: SeamDef[] = [
  { id: "capital_to_contract_gap", question: "Capital-to-contract gap. Total raised and valuation against disclosed competed awards. Stage, or belief?" },
  { id: "tense_of_proof", question: "Tense of proof. Past or future? Named, dated, competed awards in hand, or 'contracts coming'?" },
  { id: "metric_substitution", question: "Metric substitution. What does it lead with — performance against a baseline, or raises and investor names?" },
  { id: "marketing_minus_doctrine", question: "Marketing minus doctrine. Strip the doctrine language. What measured result remains?" },
  { id: "independent_customer", question: "Independent customer. Who bought and used it competitively — a competed program of record, or earmarks and pilots?" },
  { id: "credibility_broker_consortium", question: "Credibility broker and consortium. Who validated this first, who stands behind them?" },
  { id: "self_referential_legitimacy", question: "Self-referential legitimacy. Operationalize any ranking or award. Who scores it, on what?" },
  { id: "lineage_as_proof", question: "Lineage as proof. Famous founder, chairman, or ex-official standing in for evidence?" },
  { id: "removal_test_capability", question: "Removal test on capability. Remove the capital narrative, demos, and press. What independently survives?" },
  { id: "ownership_of_seams", question: "Ownership of seams. Who keeps equity, IP, the operating layer, exit rights? Remove the vendor: what continues?" },
];

// Capital allocator — swap Step 5 for attribution.
export const ALLOCATOR_SEAMS: SeamDef[] = [
  { id: "platform_vs_personal_attribution", question: "Platform vs personal vs in-the-room attribution of each claimed win." },
  { id: "whose_capital_created_outcome", question: "Whose capital created the outcome." },
  { id: "selection_before_validation", question: "Whether selection preceded social validation." },
  { id: "founder_visible_help", question: "What founder-visible help is independently tied to them." },
];

// Integrator / platform and government program / vehicle lean on removal +
// ownership; reuse the product seam frame with emphasis on the removal seams.
export function seamsForFieldSet(
  fieldSet: "product" | "allocator" | "none",
): SeamDef[] {
  if (fieldSet === "allocator") return ALLOCATOR_SEAMS;
  if (fieldSet === "product") return PRODUCT_SEAMS;
  return [];
}
