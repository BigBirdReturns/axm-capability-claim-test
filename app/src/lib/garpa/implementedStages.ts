export const IMPLEMENTED_GARPA_STAGES = [
  "claim_packet",
  "offering_admission",
  "mission_goal",
  "capability_graph",
  "component_substitution",
  "candidate_architecture",
  "qualification_contract",
  "build_manifest",
  "build_receipt",
  "preflight_receipt",
  "test_run_receipt",
  "custodied_mission_evaluation",
] as const;

export type ImplementedGarpaStage = (typeof IMPLEMENTED_GARPA_STAGES)[number];
