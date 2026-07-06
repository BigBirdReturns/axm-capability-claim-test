# Capability Claim Test — Vega-1 (illustrative frontier model)

> Structural assessment, not an allegation of wrongdoing.

**Generated:** 2026-07-06T19:13:25.781Z

## Object gate
- **Object type:** Frontier model (capability delta) (`frontier_model`)
- **Route:** Capability delta + replication pricing (`capability_delta_replication`)
- **What you are testing:** Is the claimed frontier delta independently measured, and what composition replicates it

## Sourcing gate
- **Status:** PASS — 5/3 load-bearing fields sourced.
- **Missing load-bearing fields:**
  - Tool orchestration
  - Multimodal range
  - Instruction reliability
  - Cost / latency profile

## Known evidence
- **benchmark_delta** — +11 points over the named, versioned open baseline Basalt-70B on an independent harness, both models bare. _(confirmed)_
- **context_capacity** — Usable 1M-token context; 92% needle-retrieval externally replicated. _(confirmed)_
- **long_horizon_agency** — Completes 4-hour agentic tasks at 71% vs Basalt-70B's 38% on the university benchmark; baseline ran with the same scaffold. _(reported)_
- **reasoning_depth** — Vendor model card reports large gains on graduate-level reasoning suites; no independent replication yet. _(reported)_
- **novel_synthesis** — Small-n independent study finds cross-domain synthesis quality no lesser-model composition matched. _(reported)_

## Seams
- **Named baseline. Delta over what — a named, versioned lesser model, or 'previous models'?**
  - State: `not_triggered`
  - Delta is stated against a named, versioned open baseline (Basalt-70B).
- **Eval independence. Who measured the delta — an independent harness, or the vendor's own model card?**
  - State: `unclear`
  - The headline delta is independently harnessed, but the reasoning-depth claim rests on the vendor model card alone.
- **Harness parity. Did the baseline get the same scaffolding — tools, retries, verification — before the delta was measured?**
  - State: `not_triggered`
  - Both the harness run and the horizon benchmark gave the baseline the same scaffold.
- **Benchmark saturation. Is the cited benchmark saturated, gamed, or plausibly inside the training data?**
  - State: `unclear`
  - Contamination screening not published for the reasoning suites cited in the model card.
- **Tense of the delta. Measured today on fixed tasks, or projected from a demo?**
  - State: `not_triggered`
  - Sourced deltas are measured on fixed tasks, present tense.
- **Marketing minus benchmark. Strip the launch language. What measured headroom remains?**
  - State: `triggered`
  - Strip the launch language and the multimodal, reliability, and tool-use claims have no measured headroom behind them.

## Proof contamination
- **Bucket:** Mixed / network-dependent (`mixed`)
- **Components (source-backed reasons, never a bare number):**
  - **Cap-table circularity** — not source-backed: No sourced finding on this component.
  - **Validator circularity** — present: The most-cited leaderboard placement is operated by a foundation funded by the vendor's lead investor.
  - **Broker origination** — not source-backed: No sourced finding on this component.
  - **Lineage substitution** — not source-backed: No sourced finding on this component.
  - **Independent-demand inverse** — not source-backed: No sourced finding on this component.
  - **Cross-holding density** — not source-backed: No sourced finding on this component.

## Replication plan
_The plan prices only sourced deltas. Unsourced axes are refused, not priced; sourced axes with no pricing-grade composition are named as the frontier residual._

- **Benchmark delta** — priced _(confirmed)_
  - Sourced delta priced by Cascade routing, Best-of-N + verification, Specialist fine-tune / distillation — residuals carried below.
  - **Cascade routing** `established` — Route by predicted difficulty: a cheap open classifier (or logprob/self-confidence signal) sends easy calls to a small open-weights model and escalates only the hard slice to a stronger model. Most production traffic is not frontier-hard, so the average call is priced down without touching the ceiling.
    - Residual: The escalation tier still needs the strongest model you can reach for the hardest slice — routing moves the average cost, never the ceiling.
  - **Best-of-N + verification** `established` — Sample N candidates from a lesser model and select with a mechanical verifier — unit tests, type checkers, schema validators, exact-match checkers, or a reward model. Verified selection buys back a large share of the single-shot quality gap wherever success is checkable.
    - Residual: Only works where success is cheaply checkable. Open-ended judgment tasks have no verifier, and there the single-shot frontier gap stands.
  - **Specialist fine-tune / distillation** `reported` — Distill the frontier delta for ONE domain: collect traces on your actual task distribution, fine-tune an open-weights model on them, and gate deployment on a held-out eval. Repeatedly reported to match or beat frontier models inside the trained domain.
    - Residual: Transfer is narrow: outside the trained distribution the model reverts to its base. You also inherit an eval/training loop to maintain, and trace-license terms to respect.
- **Reasoning depth** — priced _(reported)_
  - Sourced delta priced by Best-of-N + verification, Specialist fine-tune / distillation — residuals carried below.
  - **Best-of-N + verification** `established` — Sample N candidates from a lesser model and select with a mechanical verifier — unit tests, type checkers, schema validators, exact-match checkers, or a reward model. Verified selection buys back a large share of the single-shot quality gap wherever success is checkable.
    - Residual: Only works where success is cheaply checkable. Open-ended judgment tasks have no verifier, and there the single-shot frontier gap stands.
  - **Specialist fine-tune / distillation** `reported` — Distill the frontier delta for ONE domain: collect traces on your actual task distribution, fine-tune an open-weights model on them, and gate deployment on a held-out eval. Repeatedly reported to match or beat frontier models inside the trained domain.
    - Residual: Transfer is narrow: outside the trained distribution the model reverts to its base. You also inherit an eval/training loop to maintain, and trace-license terms to respect.
  - **Multi-agent debate / self-critique** `experimental` — Multiple lesser-model instances argue, critique, and revise before a judge model selects. Reported gains on some reasoning suites; inconsistent across tasks and sensitive to judge quality.
    - Residual: Gains are inconsistent and bounded by the judge: a panel of lesser models cannot reliably out-judge its own judge. A lead to test on your task, not a price.
- **Long-horizon agency** — priced _(reported)_
  - Sourced delta priced by Agentic decomposition — residuals carried below.
  - **Agentic decomposition** `reported` — Split long-horizon work into a planner and bounded workers with explicit external state — task files, checkpoints, retries, and re-planning on failure. Each bounded step sits inside a lesser model's reliable range, so horizon is carried by the harness instead of the model.
    - Residual: Errors compound across steps, and recovery from novel, unanticipated failure states remains frontier-graded — the harness carries the horizon, not the judgment.
- **Context capacity** — priced _(confirmed)_
  - Sourced delta priced by Retrieval augmentation — residuals carried below.
  - **Retrieval augmentation** `established` — Replace monolithic long context with chunked retrieval over an embedding index plus map-reduce summarization: retrieve the relevant slices, reason per-slice, then merge. Covers most 'read this huge corpus' work at a fraction of the context bill.
    - Residual: Global cross-document reasoning — where the answer lives in the interaction of far-apart passages — degrades against true long context; retrieval can only find what it thought to look for.
- **Tool orchestration** — unpriced — delta not sourced
  - Delta not sourced. The plan refuses to price a marketing claim — source tool orchestration first.
- **Multimodal range** — unpriced — delta not sourced
  - Delta not sourced. The plan refuses to price a marketing claim — source multimodal range first.
- **Instruction reliability** — unpriced — delta not sourced
  - Delta not sourced. The plan refuses to price a marketing claim — source instruction reliability first.
- **Novel synthesis** — frontier residual _(reported)_
  - Sourced delta with no pricing-grade replication. Novel synthesis is part of the honest ceiling.
  - **Multi-agent debate / self-critique** `experimental` — Multiple lesser-model instances argue, critique, and revise before a judge model selects. Reported gains on some reasoning suites; inconsistent across tasks and sensitive to judge quality.
    - Residual: Gains are inconsistent and bounded by the judge: a panel of lesser models cannot reliably out-judge its own judge. A lead to test on your task, not a price.
- **Cost / latency profile** — unpriced — delta not sourced
  - Delta not sourced. The plan refuses to price a marketing claim — source cost / latency profile first.

- **Frontier residual (what stays frontier):** Novel synthesis
- **Refused to price (delta unsourced):** Tool orchestration, Multimodal range, Instruction reliability, Cost / latency profile
- **Falsification:** Run each priced composition against the same benchmark the delta was sourced on, with harness parity. Where the composition matches the frontier score, the delta is priced; where it does not, the residual stands.

## Verdict
- **Operating proof:** B — ahead of proof — loop open
- **Rationale:** Three axes carry independently anchored, harness-parity deltas — the frontier claim is real where it is measured. But the widest launch claims (multimodal, reliability, tool use) are unsourced, and part of the cited legitimacy routes through a vendor-adjacent leaderboard. Ahead of proof, not costume.
- **Largest gap:** Breadth: the marketing surface is far wider than the measured surface.
- **Tense of proof:** Present for the harnessed axes; promissory for the rest.
- **What would clear it:** Independent, harness-parity runs on the unsourced axes, and contamination screening for the reasoning suites, would move this toward A.
- **Roots — who supplies belief:** Independent eval lab and university benchmark for the measured axes; the vendor's own launch surface for the rest.
- **Roots — who retains value:** Vendor retains weights, eval details, and pricing; open compositions replicate priced axes without them.
- **Next pulls:**
  - Independent multimodal eval with a scaffolded baseline
  - Instruction-reliability harness run
  - Contamination screen for the cited reasoning suites

---
_Output is a structural assessment, not an allegation of wrongdoing._
