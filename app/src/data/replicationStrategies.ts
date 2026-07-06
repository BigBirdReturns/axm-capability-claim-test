import type { StrategyMaturity } from "../types/audit";

export interface ReplicationStrategyDef {
  key: string;
  label: string;
  // Frontier capability axes (load-bearing field keys) this strategy addresses.
  axes: string[];
  maturity: StrategyMaturity;
  // The recipe: how open tools / lesser models are composed to cover the axis.
  composition: string;
  // Named component roles in the composition.
  components: string[];
  // MANDATORY. What the composition does NOT give back. A strategy with no
  // residual is not finished — the plan's analog of the falsification line.
  residual: string;
  costNote: string;
}

// The replication catalog. Doctrine: every entry names its residual — the plan
// never claims a composition IS the frontier model, only which sourced deltas
// it prices and what stays frontier. Maturity mirrors the evidence ladder:
//   established — widely replicated engineering practice;
//   reported    — published results, limited independent replication;
//   experimental — a lead, never a price.
export const REPLICATION_STRATEGIES: ReplicationStrategyDef[] = [
  {
    key: "cascade_routing",
    label: "Cascade routing",
    axes: ["benchmark_delta", "cost_latency_profile"],
    maturity: "established",
    composition:
      "Route by predicted difficulty: a cheap open classifier (or logprob/self-confidence signal) sends easy calls to a small open-weights model and escalates only the hard slice to a stronger model. Most production traffic is not frontier-hard, so the average call is priced down without touching the ceiling.",
    components: ["difficulty router", "small open-weights worker", "escalation tier", "fallback policy"],
    residual:
      "The escalation tier still needs the strongest model you can reach for the hardest slice — routing moves the average cost, never the ceiling.",
    costNote: "Large average-cost reduction; router adds one cheap call of latency.",
  },
  {
    key: "best_of_n_verification",
    label: "Best-of-N + verification",
    axes: ["benchmark_delta", "reasoning_depth"],
    maturity: "established",
    composition:
      "Sample N candidates from a lesser model and select with a mechanical verifier — unit tests, type checkers, schema validators, exact-match checkers, or a reward model. Verified selection buys back a large share of the single-shot quality gap wherever success is checkable.",
    components: ["open-weights sampler", "mechanical verifier (tests/checkers)", "selector"],
    residual:
      "Only works where success is cheaply checkable. Open-ended judgment tasks have no verifier, and there the single-shot frontier gap stands.",
    costNote: "N× inference on the covered slice; verifier is usually near-free.",
  },
  {
    key: "agentic_decomposition",
    label: "Agentic decomposition",
    axes: ["long_horizon_agency", "tool_orchestration"],
    maturity: "reported",
    composition:
      "Split long-horizon work into a planner and bounded workers with explicit external state — task files, checkpoints, retries, and re-planning on failure. Each bounded step sits inside a lesser model's reliable range, so horizon is carried by the harness instead of the model.",
    components: ["planner model", "bounded worker steps", "external state store", "checkpoint/retry loop"],
    residual:
      "Errors compound across steps, and recovery from novel, unanticipated failure states remains frontier-graded — the harness carries the horizon, not the judgment.",
    costNote: "More calls per task; each call is cheap. Engineering cost is in the harness.",
  },
  {
    key: "retrieval_augmentation",
    label: "Retrieval augmentation",
    axes: ["context_capacity"],
    maturity: "established",
    composition:
      "Replace monolithic long context with chunked retrieval over an embedding index plus map-reduce summarization: retrieve the relevant slices, reason per-slice, then merge. Covers most 'read this huge corpus' work at a fraction of the context bill.",
    components: ["chunker", "open embedding model", "vector index", "map-reduce merge pass"],
    residual:
      "Global cross-document reasoning — where the answer lives in the interaction of far-apart passages — degrades against true long context; retrieval can only find what it thought to look for.",
    costNote: "Indexing is one-time; per-query cost far below max-context calls.",
  },
  {
    key: "tool_scaffolding",
    label: "Tool scaffolding",
    axes: ["tool_orchestration", "instruction_reliability"],
    maturity: "established",
    composition:
      "Wrap the lesser model in a constrained harness: schema-validated structured output with automatic re-ask on violation, constrained decoding, explicit tool registries, and deterministic retry policy. Format reliability becomes a property of the harness, not the model.",
    components: ["schema validator", "constrained decoder / re-ask loop", "tool registry", "retry policy"],
    residual:
      "Scaffolds enforce format, not judgment — choosing the right tool at the right moment, and knowing when not to call one, stays model-graded.",
    costNote: "Near-free; occasional retry overhead.",
  },
  {
    key: "specialist_finetune",
    label: "Specialist fine-tune / distillation",
    axes: ["benchmark_delta", "reasoning_depth", "instruction_reliability"],
    maturity: "reported",
    composition:
      "Distill the frontier delta for ONE domain: collect traces on your actual task distribution, fine-tune an open-weights model on them, and gate deployment on a held-out eval. Repeatedly reported to match or beat frontier models inside the trained domain.",
    components: ["trace corpus from your tasks", "open-weights base model", "fine-tune pipeline", "held-out eval gate"],
    residual:
      "Transfer is narrow: outside the trained distribution the model reverts to its base. You also inherit an eval/training loop to maintain, and trace-license terms to respect.",
    costNote: "Up-front training + eval cost; cheapest per-call inference afterward.",
  },
  {
    key: "multimodal_pipeline",
    label: "Multimodal pipeline",
    axes: ["multimodal_range"],
    maturity: "established",
    composition:
      "Compose dedicated open perception models — OCR, ASR, image encoders, layout parsers — that emit text conclusions into the reasoning model, instead of one natively multimodal frontier model. Each perception stage is independently testable and swappable.",
    components: ["OCR / layout parser", "open ASR model", "vision encoder / captioner", "text reasoning model"],
    residual:
      "Joint cross-modal reasoning is lossy at the seam: whatever the perception stage didn't transcribe, the reasoner never sees. Native multimodal attention has no such seam.",
    costNote: "Perception models are cheap and cacheable; pipeline adds glue latency.",
  },
  {
    key: "multi_agent_debate",
    label: "Multi-agent debate / self-critique",
    axes: ["reasoning_depth", "novel_synthesis", "instruction_reliability"],
    maturity: "experimental",
    composition:
      "Multiple lesser-model instances argue, critique, and revise before a judge model selects. Reported gains on some reasoning suites; inconsistent across tasks and sensitive to judge quality.",
    components: ["debater instances", "judge model", "aggregation protocol"],
    residual:
      "Gains are inconsistent and bounded by the judge: a panel of lesser models cannot reliably out-judge its own judge. A lead to test on your task, not a price.",
    costNote: "Multiplies inference cost per call; wins are task-dependent.",
  },
];
