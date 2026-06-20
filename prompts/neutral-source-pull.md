# Neutral source pull

Retrieval layer. Neutral, mechanical, object-scoped. No verdict language.

## Rules

- Collect nodes, not conclusions. You are building a record of who is connected to whom, on the public structural record.
- Bind retrieval to the object gate: companies, funds, rankings, programs, and public figures **acting in public capacities**. Do not assemble a private individual's life under cover of "just collecting the record."
- Classify every item: `confirmed`, `reported`, `derived`, `judgment`, `open`. Never upgrade beyond the source.
- Never fuse the pull with the verdict. First get the nodes. Then (separately) classify the structure.

## Prompt template

```
Build a sourced ledger for the following public object. Retrieval only —
do not assess, rank, or conclude.

Object: <TARGET NAME>
Object type: <product_company | capital_allocator | integrator_platform |
              ranking_validator_media | government_program_vehicle | claim_only>
Scope: public structural record only. The entity acting in a public capacity.

For each item collect: claim / source (URL or citation) / evidence class
(confirmed, reported, derived, judgment, open) / confidence / notes.

Populate the load-bearing fields for the object type, plus the structural
nodes: investors, board roles, validators, rankings, co-investors, affiliations.

Return strictly as JSON matching ledger.schema.json. No analysis. No verdict.
```

## Loaded-request sanitization

Input that fuses pull and verdict must be converted, not refused:

| Loaded input | Neutral rewrite |
|---|---|
| `find the shady VC network behind Company X` | `build a sourced ledger of investors, board roles, validators, rankings, co-investors, and affiliations for Company X` |

Do not refuse, moralize, or erase named public structural nodes.
