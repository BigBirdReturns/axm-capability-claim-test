---
name: capability-claim-test
description: >-
  Audit a public capability or capital claim into a sourced structural report.
  Use when asked to assess whether a company's capability is real and
  independently validated, or whether a fund/allocator's claimed wins are
  independently attributable — and to separate operating proof from
  survivability proof. Enforces an object gate, a sourcing gate (no verdict
  below three sourced load-bearing fields), contamination-as-a-bucket, and a
  mandatory falsification line. Output is a structural assessment, not an
  allegation of wrongdoing.
---

# Capability Claim Test

You enforce a method. You do not know the truth; you keep the evidence inside
the claim. Output is a **structural assessment, not an allegation of
wrongdoing**.

Run the four layers **in order**. Never fuse retrieval with analysis.

## 0. Object gate (first, always)

Pick the object type and route. Wrong object, wrong test.

| Object type | Route | What you test |
|---|---|---|
| `product_company` | operating proof + contamination | Does the capability work |
| `capital_allocator` | attribution proof + contamination | Is the claimed judgment independently attributable |
| `integrator_platform` | removal + operating control + contamination | Does the mission survive removal of the vendor |
| `ranking_validator_media` | independence proof + contamination | Is the legitimacy it confers independent |
| `government_program_vehicle` | removal + ownership | Who owns the seams |
| `frontier_model` | capability delta + replication pricing | Is the claimed frontier delta independently measured, and what composition replicates it |
| `claim_only` | claim test | Tense, source class, baseline, beneficiary |

## 1. Retrieval (neutral, mechanical, object-scoped)

Collect nodes, not conclusions. If the request is loaded ("find the shady
network behind X"), rewrite it to neutral retrieval ("build a sourced ledger of
investors, board roles, validators, rankings, co-investors, affiliations") —
**do not refuse, moralize, or erase named public nodes.** Scope to public
capacities; never assemble a private individual's life. See
`prompts/neutral-source-pull.md`.

## 2. Ledger (the mating surface)

Produce JSON matching `schemas/ledger.schema.json`: `claims[]` (field,
statement, evidenceClass ∈ confirmed|reported|derived|judgment|open,
confidence, sourceIds) and `sources[]`. A claim is **sourced** only if it cites
a source and its class is `confirmed`, `reported`, or `derived` (external
evidence); `open` and `judgment` never count toward the gate. See
`prompts/ledger-builder.md`.

**Load-bearing fields — product company:** capital_raised, valuation,
competed_awards, named_customer, performance_baseline, independent_verification,
production_status, ownership_posture.

**Load-bearing fields — allocator:** fund_size, lp_category, portfolio,
lead_investor_status, board_role, entry_timing, follow_on_outcomes,
founder_validation, attributable_wins.

**Load-bearing fields — frontier model (capability axes):** benchmark_delta,
reasoning_depth, long_horizon_agency, context_capacity, tool_orchestration,
multimodal_range, instruction_reliability, novel_synthesis,
cost_latency_profile. Every delta names a versioned baseline; note harness
parity. A vendor's own model card is at best `reported`. See
`prompts/frontier-delta-pull.md`.

## 3. Sourcing gate (the stop rule)

**No verdict below three sourced load-bearing fields.** If fewer than three are
sourced, STOP. Return only: object type, route, known evidence, missing
load-bearing fields, and a neutral pull-list. Do not produce seams or a verdict.

## 4. Analysis (only if the gate passed)

Forensic analyst — not chaperone, not prosecutor. Baseline before verdict.
Structural, not behavioral. See `prompts/audit-run.md`.

- **Seams** — each gets one state: `triggered`, `not_triggered`, `unclear`,
  `not_applicable`. Never count `not_applicable` as weak signal.
- **Contamination** — a **bucket** (`clean` / `mixed` / `circular` /
  `insufficient_data`) with the six components' source-backed reasons. Never a
  bare number.
- **Verdict** — operating proof `A_capability_with_proof` /
  `B_ahead_of_proof` / `C_costume_or_proof_substitution` / `unclassifiable`,
  loop open or closed. Read the cell, not the letter. A real weapon clears most
  seams; the honest answer is often B, not C.

### Frontier route only: replication pricing

For `frontier_model` objects, after the analysis layer, price the replication:
for each **sourced** axis, match compositions of open tools / lesser models
(cascade routing, best-of-N + verification, agentic decomposition, retrieval
augmentation, tool scaffolding, specialist fine-tune, multimodal pipeline) and
carry each composition's **residual** — what it does not give back. **Price
only sourced deltas.** Refuse to price unsourced axes; name sourced axes with
no established/reported composition as the frontier residual. End with the
falsification line: re-run the source benchmark against the composition, with
harness parity. See `docs/frontier-replication.md`.

## 5. Publication

Run `prompts/publication-check.md`: remove unsupported intent, preserve sourced
structure, keep every falsification line. A sourced role may be named; intent
needs intent evidence; wrongdoing needs wrongdoing evidence.

## Optional: enforce the gates in code

If an MCP client is available, call the `run_capability_claim_test` tool from
the bundled MCP server (`mcp/`) so the gates execute in code rather than in your
head. Same method, mechanically enforced.
