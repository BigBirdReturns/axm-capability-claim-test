# HANDOFF — Capability Claim Test

**The "pick this up cold and succeed" artifact.** Read this first. It states
what the thing is, where it stands, the conventions to uphold, and the open work.

_Last updated: 2026-06-20._

---

## 1. What this is

A **static GitHub Pages workbench** that turns public field data into a sourced
capability-and-contamination report. It is **not an AI app** — no backend, no
API keys, no network. The whole method runs locally in the browser.

> The page does not know the truth. It enforces the method.

That sentence is the thesis. The architecture backs it: the gate logic lives in
pure functions, and the UI cannot produce a verdict the gates didn't allow.

The output is a **structural assessment, not an allegation of wrongdoing**. (The
old internal codename has been retired from the repo entirely — do not
reintroduce it.)

## 2. How a user uses it

Live: https://bigbirdreturns.github.io/axm-capability-claim-test/

Five buttons. The four **examples** are the fastest orientation and double as the
regression suite:

| Example | Object | Proves |
|---|---|---|
| Cleared Capability | product_company | **Acquit** — verdict A, contamination clean |
| Circular / Unproven | product_company | **Classify** — verdict C, contamination circular |
| Insufficient Ledger | product_company | **Refuse to verdict** — pull-list only |
| Capital Allocator… | capital_allocator | **Route** — attribution fields, not product seams |

**Start New Audit** runs the real flow: pick object type → fill load-bearing
fields (claim + source + evidence class) → sourcing gate unlocks the verdict at
three sourced fields → read contamination bucket + verdict → export md/json/csv.

## 3. The method (what the gates enforce)

1. **Object gate** (`runObjectGate`) — routes by object type *before* any seams
   render. A capital allocator cannot be pushed through the product instrument.
2. **Sourcing gate** (`runSourcingGate`) — the stop rule. A claim is "sourced"
   iff it cites ≥1 source AND its evidence class is not `open`. Below **three**
   sourced load-bearing fields, the verdict is blocked and a neutral pull-list
   is returned instead.
3. **Seams** (`runSeams`) — formal states `triggered` / `not_triggered` /
   `unclear` / `not_applicable`. `not_applicable` is **never** counted as weak
   signal.
4. **Contamination** (`runContaminationBucket`) — a **bucket** (clean / mixed /
   circular / insufficient_data) with source-backed component reasons. **Never
   a bare number** in the UI; internal scores stay internal.
5. **Verdict** — `A_capability_with_proof` / `B_ahead_of_proof` /
   `C_costume_or_proof_substitution` / `unclassifiable` / `not_applicable`, with
   a mandatory falsification line ("what would clear it").

## 4. Architecture (the method is split from the UI)

```
app/src/
  types/audit.ts          canonical types (the ledger contract)
  data/                   objectRoutes, loadBearingFields, seams, contamination
  lib/                    THE METHOD — pure functions, no React:
    validateLedger.ts       zod validation of the ledger (the mating surface)
    runObjectGate.ts        \
    runSourcingGate.ts       } the gates
    runContaminationBucket.ts/
    runSeams.ts
    renderReport.ts         buildReport() + markdown rendering
    generateNeutralPrompt.ts neutral retrieval + loaded-request sanitization
    exportFiles.ts          md / json / csv, all client-side
    adapters/               ProviderAdapter interface + MockAdapter (no calls)
  components/             one panel per stage; App.tsx wires the sequence
schemas/                 JSON Schemas mirrored by validateLedger
prompts/                 neutral-source-pull, ledger-builder, audit-run, publication-check
docs/                    the method + doctrines + regression-suite
examples/                4 worked ledgers + generated report/pull-list outputs
tests/lib/               vitest: gates, validation, examples-as-regression
mcp/                     MCP server — same lib functions as tools
skill/                   Agent Skill — zero-install door
```

**Three doors, one set of gates:** the web app, the MCP server (`mcp/server.ts`),
and the skill all run/reference the same `app/src/lib/` functions. The verdict
logic cannot drift between them. Preserve this.

## 5. Run / test / deploy

```bash
npm install
npm run dev        # local workbench at localhost:5173
npm run check      # typecheck + vitest — THE GATE. Keep this green.
npm run build      # static build into dist/
```

- **CI/deploy:** `.github/workflows/deploy.yml` runs `npm run check` then builds
  and publishes `dist/` to Pages (Actions source). `check` is a hard gate — a
  red build never ships.
- **MCP server:** `cd mcp && npm install && npx tsx server.ts` (see `mcp/README.md`).

## 6. Current state (read before you push)

- **Live site:** green, current, serving from the **`claude/tender-rubin-n26gr6`**
  branch deploy. The footer no longer carries the retired codename.
- **Branches:** PR **#1** (already merged to `main`) carried the first wave
  (build + zod/vitest conformance). The `claude/tender-rubin-n26gr6` branch is
  now **ahead of `main`** again with the review fixes (preview dedup, workflow
  doc, codename removal, README usage, this handoff). `main` does **not** have
  these yet — open a PR (feature → main) to reconcile.
- **⚠️ Pages env gotcha:** the `github-pages` environment was pinned to the
  branch that was default when Pages was first enabled, so **`main`-triggered
  deploys FAIL at the deploy step** ("build" passes, "deploy" fails). Fix:
  **Settings → Environments → github-pages → Deployment branches → allow `main`
  (or All branches)**. Until then, deploys only succeed from the feature branch.
- **Default branch:** worth setting to `main` (Settings → General) now that #1 is
  merged.

## 7. Conventions to uphold (AXM house style, this repo's slice)

This repo conforms to AXM **engineering** scaffolding but keeps its **own visual
identity** (dark theme, system fonts — deliberately *not* the axm-arc
cream/brick-red look). Specifically:

- **zod** for all schema validation; the ledger schema is the mating surface.
- **vitest** + `npm run check` as the CI gate. New logic ships with tests.
- Double quotes; dense "why not what" comments.
- Contamination is **always** a bucket with sourced reasons — never a bare score.
- The gates are **sequenced and structural**, not warning banners. Keep the
  object gate before seams and the sourcing gate before the verdict.
- The retired internal codename stays retired.

## 8. Open work (prioritized)

1. **Logic-airtightness audit** (the substantive one). Verify the gates are as
   airtight as the README claims. Edge cases to nail down with tests:
   - Duplicate claims on the same load-bearing field (which one wins in
     `runSourcingGate` / "known evidence").
   - `not_applicable` seam accounting (confirm it never contributes to weak
     signal anywhere, including future weighting).
   - `runContaminationBucket` when annotations are **partial** (some components
     present without reasons, explicit bucket vs derived bucket disagreement).
   - `buildReport` when `verdictNotes` is absent but the gate passes (currently
     yields `unclassifiable` — confirm that's the intended floor).
2. **Reconcile branches:** PR the feature branch into `main`; fix the Pages env
   so `main` deploys.
3. **Optional — deeper UX:** the manual form is functional but minimal (no
   per-claim multi-source UI, no seam/contamination editing in-form; those come
   via Import JSON / LLM mode today).
4. **Optional — visual identity:** if an AXM-styled skin is ever wanted, it's a
   self-contained `styles.css` pass; intentionally not done.

## 9. Definition of done (the standard)

A change is finished when: `npm run check` is green; the three doors still share
one set of gates; contamination still renders as a bucket-with-reasons; every
verdict still carries its falsification line; and no public surface reintroduces
the retired codename. If any of those is false, it is not finished.
