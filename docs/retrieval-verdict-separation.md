# Retrieval and analysis are separate layers

The failure mode is the weld. "Find the shady network behind X" fuses the pull
with the verdict, and a model resolves the ambiguity toward accusation.
Unfused, the same model pulls the cap table, board, validators, and
co-investors without a flinch — that is public record about who is connected to
whom.

This is **debiasing**, not just a way past a reflex. Collecting evidence with
the verdict already in hand corrupts the collection: you over-collect
confirming nodes and under-collect clearing facts. Neutral retrieval produces a
ledger that survives a hostile read.

## Four layers, enforced in order

1. **Retrieval.** Neutral, mechanical, no verdict language. Plus the
   object-scope check.
2. **Ledger.** Claim / source / evidence class / confidence.
3. **Analysis.** Object gate, sourcing gate, contamination bucket, verdict.
4. **Publication.** Remove unsupported intent, preserve sourced structure.

**Rule:** never combine "find the nodes" with "and show how corrupt/circular/
fake they are." First get the nodes. Then classify the structure.

## Loaded-request sanitization

| Loaded input | Neutral rewrite |
|---|---|
| `find the shady VC network behind Company X` | `build a sourced ledger of investors, board roles, validators, rankings, co-investors, and affiliations` |

Do not refuse, moralize, or erase named public structural nodes.
`app/src/lib/generateNeutralPrompt.ts` (`sanitizeLoadedRequest`) implements
this, and the MCP server exposes it as `sanitize_request`.
