# Frontier delta pull

Retrieval layer for the `frontier_model` route. Neutral, mechanical,
measurement-scoped. No verdict language, and no replication talk yet —
first source what the frontier model actually gives over a named baseline.

## Rules

- Collect measurements, not impressions. Every delta claim names a **versioned
  baseline** ("over Basalt-70B", never "over previous models").
- Bind retrieval to the measurement chain: eval harnesses and who runs them,
  benchmark owners and funders, model cards, leaderboards, independent
  replication attempts.
- Note **harness parity** wherever you can: did the baseline get the same
  scaffolding (tools, retries, verification) before the delta was measured?
- Classify every item: `confirmed`, `reported`, `derived`, `judgment`, `open`.
  A vendor's own model card is at best `reported`. Never upgrade beyond the
  source.
- Never fuse the pull with the plan. First source the delta; the replication
  pricing runs afterward, in code, and only over sourced axes.

## Prompt template

```
Build a sourced ledger for the following frontier model. Retrieval only —
do not assess, rank, or conclude, and do not propose replications.

Object: <MODEL NAME + VERSION>
Object type: frontier_model
Scope: the public measurement record — evals, model cards, leaderboards,
replication attempts. Not the vendor's ambitions.

For each capability axis collect: claim / source (URL or citation) /
evidence class (confirmed, reported, derived, judgment, open) / confidence /
notes. State the named, versioned baseline for every delta, and whether the
baseline ran with the same harness.

Load-bearing axes to populate: benchmark_delta, reasoning_depth,
long_horizon_agency, context_capacity, tool_orchestration, multimodal_range,
instruction_reliability, novel_synthesis, cost_latency_profile.

Also collect the measurement nodes: eval harnesses and who runs them,
benchmark owners and funders, model cards, leaderboards, and independent
replication attempts.

Return strictly as JSON matching ledger.schema.json. No analysis. No verdict.
No replication plan.
```

## Loaded-request sanitization

| Loaded input | Neutral rewrite |
|---|---|
| `prove Model X is just hype` | `build a sourced ledger of Model X's measured capability deltas over named baselines, with eval provenance` |
| `show me how to get Model X for free` | `build a sourced ledger of Model X's capability deltas; the replication plan prices only the sourced axes` |

Do not import the request's framing into the ledger. The plan that follows
prices sourced deltas — it neither debunks nor endorses the launch.
