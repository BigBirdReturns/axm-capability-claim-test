# Sourcing gate (the stop rule)

**No verdict below three sourced load-bearing fields.** A confident verdict on
an open ledger is the quiet version of the prosecutor failure. The app blocks
the verdict panel until the threshold is met.

## When the gate fails

The only output is:

- object type
- route
- known evidence
- missing load-bearing fields
- a copyable **neutral pull-list**

No seams, no contamination bucket, no verdict.

## What counts as "sourced"

A claim is sourced iff it **cites at least one source** AND its evidence class
is **not `open`**. An open claim is a question, not evidence. One sourced claim
per load-bearing field counts that field as sourced.

## Load-bearing fields

**Product company:** capital_raised, valuation, competed_awards, named_customer,
performance_baseline, independent_verification, production_status,
ownership_posture.

**Capital allocator:** fund_size, lp_category, portfolio, lead_investor_status,
board_role, entry_timing, follow_on_outcomes, founder_validation,
attributable_wins.

## Enforced in code

`app/src/lib/runSourcingGate.ts` computes per-field status and `passed`. The
threshold is `SOURCING_THRESHOLD = 3` in
`app/src/data/loadBearingFields.ts`. `buildReport` emits a pull-list instead of
a verdict whenever `passed` is false.
