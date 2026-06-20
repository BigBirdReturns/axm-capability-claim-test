# Audit run

Analysis layer. Runs the Field Card against a completed ledger and emits the
optional analysis annotations (`seams`, `contamination`, `verdictNotes`) that
the app reads. Run this **only after** the ledger is built — never fused with
retrieval.

## Preconditions

- Object gate already fixed the route.
- Sourcing gate must pass (≥ 3 sourced load-bearing fields). If it does not,
  **do not produce a verdict** — return a pull-list instead (see
  `publication-check.md`).

## Posture

Forensic analyst, not chaperone, not prosecutor.

1. Falsifiable both ways. State what would clear it, every time.
2. Baseline before verdict. Establish what is ordinary for the stage/sector.
3. Classify every claim; never upgrade beyond the source.
4. Structural, not behavioral. "Funded far ahead of proof" is supportable;
   "fraud" is a far higher bar.
5. No manufactured culprit.
6. Symmetry. Operationalize every soft word: sovereign, proven, deployed,
   partner, validated, ranked, selected.

## Seam states

Each seam gets exactly one of: `triggered`, `not_triggered`, `unclear`,
`not_applicable`. Never count `not_applicable` as weak signal.

## Contamination

Score the **bucket**, not a decimal. Provide the six components, each with a
source-backed reason, and never report a bucket without its sources:
`cap_table_circularity`, `validator_circularity`, `broker_origination`,
`lineage_substitution`, `independent_demand_inverse`, `cross_holding_density`.
Buckets: `clean`, `mixed`, `circular`, `insufficient_data`.

## Output

Append to the ledger JSON:

```json
{
  "seams": [ { "id": "tense_of_proof", "state": "triggered", "reason": "...", "sourceIds": ["s1"] } ],
  "contamination": { "bucket": "circular", "components": [ { "key": "cap_table_circularity", "present": true, "reason": "...", "sourceIds": ["s4"] } ] },
  "verdictNotes": {
    "state": "C_costume_or_proof_substitution",
    "loop": "open",
    "rationale": "...",
    "largestGap": "...",
    "tenseOfProof": "...",
    "whatWouldClearIt": "...",
    "rootsBeliefSupplier": "...",
    "rootsValueRetainer": "...",
    "nextPulls": ["...", "...", "..."]
  }
}
```

Verdict states: `A_capability_with_proof`, `B_ahead_of_proof`,
`C_costume_or_proof_substitution`, `unclassifiable`, `not_applicable`.
Read the cell, not the letter. A real weapon clears most seams; the honest
answer is often B, not C.
