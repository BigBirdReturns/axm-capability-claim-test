# Authoring a ledger

The **ledger** is the one object every door reads — manual entry, LLM paste,
adapter output, and the MCP server all produce the same shape and feed it to the
same gates. If the ledger is right, the report is right. This page is the
practical guide the README points at: how to write one by hand (or check what a
model handed back) so it passes validation and gets read the way you intend.

> Reminder of the thesis: **the page does not know the truth, it enforces the
> method.** A ledger is your sourced account of the public record; the gates only
> decide what that account is allowed to conclude.

---

## 1. The shape

A ledger is a single JSON object. The required top-level fields:

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `1` | Literal. Bump only with a schema change. |
| `objectType` | enum | What you're auditing — fixes the route. See list below. |
| `targetName` | string | The thing under audit. Required, non-empty. |
| `claims` | array | One or more claims against load-bearing fields. |
| `sources` | array | Every source a claim cites must appear here. |

Optional (the **analysis annotations** — usually filled by an audit run, not by
hand): `context`, `seams`, `contamination`, `verdictNotes`. When absent the app
computes neutral defaults, so a retrieval-only ledger is valid and useful — it
just yields a pull-list until the sourcing gate passes.

`objectType` is one of: `product_company`, `capital_allocator`,
`integrator_platform`, `ranking_validator_media`, `government_program_vehicle`,
`claim_only`. The object gate routes each to its own load-bearing field set, so
**pick this first** — a fund audited as `product_company` asks the wrong
questions.

A **claim** is `{ id, field, statement, evidenceClass, sourceIds[], confidence?,
notes? }`. A **source** is `{ id, title, url?, publisher?, date?, note? }`.

---

## 2. The source-ID rule (the one that bites)

A claim cites sources by **id**, and **every id in a claim's `sourceIds` must
resolve to a source in the top-level `sources` array.** A claim citing a phantom
id is treated as unsourced — the gate is self-contained and re-checks this even
if you skipped validation. This is deliberate: you cannot pass the gate by
writing `"sourceIds": ["s9"]` without an `s9` to back it.

So: give each source a stable id (`s1`, `s2`, …), define it once in `sources`,
and reference that id from every claim it backs. One source can back many claims.

---

## 3. Evidence classes — the decision table

The evidence class records **how strongly the public record backs the claim** —
and it is load-bearing, because the sourcing gate only counts **external**
classes. Never upgrade a claim beyond its source.

| Class | Use when… | Counts toward the gate? |
|---|---|---|
| `confirmed` | A primary/authoritative record states it directly — filing, contract award, official register, audited figure. | ✅ yes |
| `reported` | A credible secondary source reports it — reputable press, a company statement, a customer's own site. Not independently verified, but externally attributed. | ✅ yes |
| `derived` | You computed/inferred it from sourced facts (e.g. a ratio from two filings). The inputs are sourced; the figure is yours. | ✅ yes |
| `judgment` | Your interpretive read — "this validation looks circular," "this demand looks thin." | ❌ **no** |
| `open` | A placeholder: the field is named but nothing is sourced yet. | ❌ no |

**Why `judgment` does not count.** The sourcing gate exists to require external
anchoring before any verdict. `judgment` is the analyst's own call, so three
judgments are not three sources — letting them unlock a verdict would let an
analyst freehand straight past the gate. A judgment claim is still recorded and
shown as known evidence (and it's the right home for genuine interpretation);
it just can't be one of the three fields that opens the verdict. If a judgment
is actually backed by an external record, classify it by that record
(`reported`/`derived`), not as `judgment`.

Picking between the external classes, in practice:

- A **press release** asserting a deployment → `reported` (it's the subject
  speaking), not `confirmed`.
- A **customer logo** on a vendor's site → `reported` at best; the customer
  hasn't confirmed the use.
- A **government contract award** in a public register → `confirmed`.
- A **revenue-per-headcount figure** you computed from two filings → `derived`.

---

## 4. The sourcing gate, concretely

A **load-bearing field counts as sourced** when at least one of its claims is an
external class (`confirmed`/`reported`/`derived`) **and** cites a resolving
source. Notes:

- **One field counts once.** Three sourced claims on a single field is still one
  sourced field — you can't stack one field to reach the threshold of three.
- **Any sourced claim wins** for that field, regardless of order; the reported
  evidence class is the sourced claim's, not an `open` sibling's.
- Below **three** sourced fields the report is a **pull-list** (object, route,
  known evidence, missing fields) — no seams, contamination, or verdict.

---

## 5. Three ledgers to copy

### 5a. Minimal valid (retrieval-only, will refuse to verdict)

Valid against the schema; one sourced field, so the gate blocks and you get a
pull-list. This is the honest starting state of a real audit.

```json
{
  "schemaVersion": 1,
  "objectType": "product_company",
  "targetName": "Acme Robotics",
  "sources": [
    { "id": "s1", "title": "SEC Form D filing", "publisher": "SEC", "date": "2024-03-01" }
  ],
  "claims": [
    { "id": "c1", "field": "capital_raised", "statement": "Raised $40M Series B.", "evidenceClass": "confirmed", "sourceIds": ["s1"] }
  ]
}
```

### 5b. Passing (unlocks the verdict)

Three external-class fields each cite a resolving source, so the gate opens. With
no analysis annotations the verdict comes back `not_supplied` — the gate passed,
but the analysis layer hasn't been run. Add `seams` / `contamination` /
`verdictNotes` to classify.

```json
{
  "schemaVersion": 1,
  "objectType": "product_company",
  "targetName": "Acme Robotics",
  "sources": [
    { "id": "s1", "title": "SEC Form D filing", "publisher": "SEC", "date": "2024-03-01" },
    { "id": "s2", "title": "DoD contract award notice", "publisher": "USASpending", "date": "2024-06-10" },
    { "id": "s3", "title": "Independent test-range report", "publisher": "NIST", "date": "2024-08-22" }
  ],
  "claims": [
    { "id": "c1", "field": "capital_raised", "statement": "Raised $40M Series B.", "evidenceClass": "confirmed", "sourceIds": ["s1"] },
    { "id": "c2", "field": "competed_awards", "statement": "Won a competed $12M defense award.", "evidenceClass": "confirmed", "sourceIds": ["s2"] },
    { "id": "c3", "field": "independent_verification", "statement": "Performance verified at an independent range.", "evidenceClass": "confirmed", "sourceIds": ["s3"] }
  ]
}
```

### 5c. Failing (validation rejects it)

Two common mistakes at once: a claim cites `s2`, which isn't defined, and the
evidence class is misspelled. `validateLedger` rejects it; the phantom source
also wouldn't count even if you bypassed validation.

```json
{
  "schemaVersion": 1,
  "objectType": "product_company",
  "targetName": "Acme Robotics",
  "sources": [
    { "id": "s1", "title": "SEC Form D filing" }
  ],
  "claims": [
    { "id": "c1", "field": "capital_raised", "statement": "Raised $40M.", "evidenceClass": "Confirmed", "sourceIds": ["s2"] }
  ]
}
```

Fixes: `"evidenceClass": "confirmed"` (lower-case enum value), and either define
`s2` in `sources` or cite `s1`.

---

## 6. Writing good statements

- **One fact per claim.** "Raised $40M and won a defense contract" is two claims
  on two fields.
- **State the fact, not the conclusion.** "Validation came from an independent
  national range" is a claim; "the validation is legitimate" is a verdict the
  gates produce, not a claim you assert.
- **Match the tense to the source.** If the source says "plans to deploy," don't
  write "deployed."
- **Keep interpretation in `judgment` claims or the analysis annotations**, never
  smuggled into a `confirmed` statement.

---

## 7. Where this fits

The ledger is validated by [`app/src/lib/validateLedger.ts`](../app/src/lib/validateLedger.ts)
(zod, mirroring [`schemas/ledger.schema.json`](../schemas/ledger.schema.json))
and consumed by `buildReport`. The four worked ledgers in
[`examples/`](../examples/) are real, valid instances — read them alongside this
page, and see [`docs/regression-suite.md`](regression-suite.md) for what each one
proves.
