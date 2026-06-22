// Core type contract for the Capability Claim Test.
// These types mirror the JSON Schemas in /schemas and are the mating surface
// between manual entry, LLM-assisted ledgers, and adapter output.

export type ObjectType =
  | "product_company"
  | "capital_allocator"
  | "integrator_platform"
  | "ranking_validator_media"
  | "government_program_vehicle"
  | "claim_only";

export type Route =
  | "operating_proof_contamination"
  | "attribution_proof_contamination"
  | "removal_test_operating_control_contamination"
  | "independence_proof_contamination"
  | "removal_test_ownership"
  | "claim_test";

// Evidence class — never upgrade a claim beyond its source.
export type EvidenceClass =
  | "confirmed"
  | "reported"
  | "derived"
  | "judgment"
  | "open";

export interface Source {
  id: string;
  title: string;
  url?: string;
  publisher?: string;
  date?: string; // ISO 8601 where known
  note?: string;
}

export interface Claim {
  id: string;
  // The load-bearing field this claim speaks to, e.g. "capital_raised".
  field: string;
  statement: string;
  evidenceClass: EvidenceClass;
  // 0..1 analyst confidence. Internal only; never travels as a verdict.
  confidence?: number;
  // Source ids backing this claim. A claim counts as "sourced" toward the
  // sourcing gate iff it cites at least one resolving source AND its evidence
  // class is external — i.e. not "open" and not "judgment" (the analyst's own
  // call, which is recorded but never unlocks a verdict on its own).
  sourceIds: string[];
  notes?: string;
}

export interface Ledger {
  schemaVersion: 1;
  objectType: ObjectType;
  targetName: string;
  claims: Claim[];
  sources: Source[];
  // Optional free-form context captured during retrieval.
  context?: string;
  // Optional analysis annotations produced by an audit run (LLM-assisted or
  // manual). When absent, the app computes neutral defaults from the claims.
  seams?: LedgerSeamAnnotation[];
  contamination?: LedgerContaminationAnnotation;
  verdictNotes?: LedgerVerdictAnnotation;
}

// Analysis annotations are intentionally loose: an external model fills them
// against the published schema. validateLedger normalizes them.
export interface LedgerSeamAnnotation {
  id: string;
  question?: string;
  state: SeamState;
  reason?: string;
  sourceIds?: string[];
}

export interface LedgerContaminationComponentAnnotation {
  key: ContaminationComponentKey;
  present: boolean;
  reason?: string;
  sourceIds?: string[];
  internalScore?: number;
}

export interface LedgerContaminationAnnotation {
  bucket?: ContaminationBucket;
  components?: LedgerContaminationComponentAnnotation[];
}

export interface LedgerVerdictAnnotation {
  state?: VerdictState;
  loop?: Loop;
  rationale?: string;
  largestGap?: string;
  tenseOfProof?: string;
  whatWouldClearIt?: string;
  rootsBeliefSupplier?: string;
  rootsValueRetainer?: string;
  nextPulls?: string[];
}

// ---- Formal seam states ----------------------------------------------------

export type SeamState =
  | "triggered"
  | "not_triggered"
  | "unclear"
  | "not_applicable";

export interface SeamResult {
  id: string;
  question: string;
  state: SeamState;
  // What the ledger says, in one line. Sourced where possible.
  reason: string;
  sourceIds: string[];
}

// ---- Contamination ---------------------------------------------------------

export type ContaminationComponentKey =
  | "cap_table_circularity"
  | "validator_circularity"
  | "broker_origination"
  | "lineage_substitution"
  | "independent_demand_inverse"
  | "cross_holding_density";

export type ContaminationBucket =
  | "clean"
  | "mixed"
  | "circular"
  | "insufficient_data";

export interface ContaminationComponent {
  key: ContaminationComponentKey;
  label: string;
  // Source-backed reason. Never a bare number in the UI.
  reason: string;
  sourceIds: string[];
  // Optional internal-only score 0..100. Never rendered publicly.
  internalScore?: number;
  present: boolean;
}

export interface ContaminationResult {
  bucket: ContaminationBucket;
  components: ContaminationComponent[];
}

// ---- Sourcing gate ---------------------------------------------------------

export interface LoadBearingFieldStatus {
  field: string;
  label: string;
  sourced: boolean;
  evidenceClass?: EvidenceClass;
}

export interface SourcingGateResult {
  required: number;
  sourcedCount: number;
  passed: boolean;
  fields: LoadBearingFieldStatus[];
  missing: LoadBearingFieldStatus[];
}

// ---- Object gate -----------------------------------------------------------

export interface ObjectGateResult {
  objectType: ObjectType;
  objectLabel: string;
  route: Route;
  routeLabel: string;
  whatYouAreTesting: string;
}

// ---- Verdict ---------------------------------------------------------------

export type VerdictState =
  | "A_capability_with_proof"
  | "B_ahead_of_proof"
  | "C_costume_or_proof_substitution"
  | "unclassifiable" // method ran; genuinely ambiguous
  | "not_supplied" // analysis layer not filled in; no verdict exists yet
  | "not_applicable";

export type Loop = "open" | "closed";

export interface Verdict {
  state: VerdictState;
  loop: Loop;
  rationale: string;
  largestGap: string;
  tenseOfProof: string;
  // Mandatory falsification line — stated even when you suspect it cannot
  // be produced.
  whatWouldClearIt: string;
  rootsBeliefSupplier: string;
  rootsValueRetainer: string;
  nextPulls: string[];
}

// ---- Report ----------------------------------------------------------------

export interface Report {
  generatedAt: string;
  target: string;
  objectGate: ObjectGateResult;
  sourcingGate: SourcingGateResult;
  // Present only when the sourcing gate passes.
  seams?: SeamResult[];
  contamination?: ContaminationResult;
  verdict?: Verdict;
  // Present only when the sourcing gate fails (insufficient ledger).
  pullList?: string[];
  knownEvidence: { field: string; statement: string; evidenceClass: EvidenceClass }[];
  ledger: Ledger;
}
