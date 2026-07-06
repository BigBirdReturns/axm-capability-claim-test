# The frontier route — capability delta + replication pricing

The `frontier_model` object type turns the instrument on the claims frontier
AI vendors make about their own models: *what does the frontier-est model
actually give you over the rest, and how much of that can a composition of
open tools and lesser models give back?*

The route has two halves, and the second is gated on the first:

1. **Delta audit** — the standard method. Each capability axis is a
   load-bearing field; a delta claim counts only when it is externally sourced.
2. **Replication pricing** — for each **sourced** delta, the plan matches
   compositions from the replication catalog, carrying each composition's
   residual verbatim.

> The plan prices only sourced deltas. Unsourced axes are refused, not priced;
> sourced axes with no pricing-grade composition are named as the frontier
> residual.

## Why the gate matters here

A replication plan is an implicit endorsement: "here is how to rebuild X"
asserts that X exists. Pricing an unsourced launch claim would launder
marketing into an engineering roadmap. So the plan runs behind the same
sourcing gate as everything else (three sourced axes or you get a pull-list),
and within it, **each axis** is priced only if its own delta is sourced —
`open` and `judgment` never price an axis, exactly as they never unlock a
verdict.

## The capability axes (load-bearing fields)

`benchmark_delta`, `reasoning_depth`, `long_horizon_agency`,
`context_capacity`, `tool_orchestration`, `multimodal_range`,
`instruction_reliability`, `novel_synthesis`, `cost_latency_profile`.

Every delta claim should name a **versioned baseline** and state whether the
baseline ran with **harness parity** — the same tools, retries, and
verification the frontier model got. Most published deltas fail that seam.

## The seams

Six forced questions: named baseline, eval independence, harness parity,
benchmark saturation, tense of the delta, marketing minus benchmark. Same
formal states as every route (`triggered` / `not_triggered` / `unclear` /
`not_applicable`); `not_applicable` is never weak signal.

## Contamination, reused

The contamination components apply verbatim — the circularity just lives in
the proof chain instead of a cap table. `validator_circularity` is the load
star: a leaderboard or benchmark funded by the vendor's own capital network
confers legitimacy the same way a sponsored ranking does for a product
company. The bucket doctrine is unchanged: a bucket with source-backed
reasons, never a bare number.

## The replication catalog (`app/src/data/replicationStrategies.ts`)

Each strategy declares the axes it addresses, its **maturity**, its
composition, and a **mandatory residual** — what the composition does *not*
give back. Maturity is an allowlist mirroring the evidence classes:

| Maturity | Prices an axis? | Meaning |
|---|---|---|
| `established` | yes | widely replicated engineering practice |
| `reported` | yes | published results, limited independent replication |
| `experimental` | **no** | a lead to test, never a price |

An unknown or misspelled maturity fails closed (`isPricingStrategy`), the same
way an unknown evidence class fails the sourcing gate.

## The three axis outcomes

| Status | Meaning |
|---|---|
| `priced` | Sourced delta + at least one pricing-grade composition. The recipe, with residuals carried verbatim. |
| `frontier_residual` | Sourced delta no pricing-grade composition covers. The honest ceiling — what you actually pay the frontier for. |
| `unpriced_delta` | Delta not sourced. Refused. Source it first. |

The plan ends on a falsification line, like every verdict: run each priced
composition against the same benchmark the delta was sourced on, with harness
parity. Where the composition matches, the delta is priced; where it does
not, the residual stands.

## What this is not

- **Not a router.** The plan is a sourced structural assessment of what is
  replicable, not a runtime dispatcher. (A cascade router is one of the
  *strategies* it can recommend.)
- **Not a benchmark.** The instrument retrieves nothing and measures nothing;
  you bring the harness runs as sources.
- **Not a verdict on the vendor.** `B_ahead_of_proof` on a frontier model
  means the marketing surface is wider than the measured surface — a
  structural read, not an allegation.

## Doors

- **Web app** — pick "Frontier model (capability delta)", or load the
  worked example (`examples/frontier-delta-replication/`).
- **MCP** — `build_replication_plan` and `list_replication_strategies`
  (`mcp/server.ts`), behind the same gates in code.
- **Prompt** — `prompts/frontier-delta-pull.md` for the neutral retrieval
  half; paste the ledger back into any door.
