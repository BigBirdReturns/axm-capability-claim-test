import type { ContaminationComponentKey } from "../types/audit";

export interface ContaminationComponentDef {
  key: ContaminationComponentKey;
  label: string;
  question: string;
}

// Field Card, Step 6 — six things to look at. The bucket is the output;
// component scores are internal and never travel without their reasons.
export const CONTAMINATION_COMPONENTS: ContaminationComponentDef[] = [
  {
    key: "cap_table_circularity",
    label: "Cap-table circularity",
    question:
      "How much capital is the recurring consortium and its vehicles versus outside money.",
  },
  {
    key: "validator_circularity",
    label: "Validator circularity",
    question:
      "How much cited legitimacy comes from rankings, awards, events, accelerators, or media the same capital funds or grades.",
  },
  {
    key: "broker_origination",
    label: "Broker origination",
    question:
      "Was it first-checked, sourced, or boarded by someone whose function is routing into that consortium.",
  },
  {
    key: "lineage_substitution",
    label: "Lineage substitution",
    question:
      "How much legitimacy is famous names and ex-affiliations rather than competed outcomes.",
  },
  {
    key: "independent_demand_inverse",
    label: "Independent-demand inverse",
    question:
      "How thin competed external demand is against cumulative capital. Compare like to like.",
  },
  {
    key: "cross_holding_density",
    label: "Cross-holding density",
    question:
      "How much the backers, board, primes, and validators recur across each other.",
  },
];
