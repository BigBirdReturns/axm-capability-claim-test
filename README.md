# Capability Claim Test

> Bring your own sources. Bring your own model. The method enforces the ledger.

A **static claim-audit workbench** for turning public field data into a sourced
capability and contamination report. It is a static GitHub Pages instrument,
**not an AI app**: the page holds no API keys, calls no backend, and runs the
whole method locally in your browser. **The page does not know the truth. It
enforces the method.**

The output is a **structural assessment, not an allegation of wrongdoing**.

## How to use it (in 60 seconds)

Open the live page: **https://bigbirdreturns.github.io/axm-capability-claim-test/**

A left rail shows the **four-layer method** as a spine and a **live sourcing-gate
meter**; the main column is the audit, staged Object → Ledger → Analysis →
Report. Start by clicking a **worked-example card** — the fastest way to see what
the tool does:

- **Cleared Capability** → a company with real proof. The tool *acquits* it:
  verdict **A**, contamination **clean**.
- **Circular / Unproven** → a company whose legitimacy is manufactured by its own
  backers. The tool *classifies* it: verdict **C**, contamination **circular** —
  each reason sourced.
- **Insufficient Ledger** → too little is sourced, so the tool *refuses to
  verdict* and hands back a **pull-list** of what to go find.
- **Capital Allocator** → the tool routing a fund through *attribution*
  questions, not product-company ones.

To run your own, click **Start a blank audit**, then:

1. Pick the **object type** (company, fund, ranking, program…). This fixes the
   route — you can't push a fund through the company instrument.
2. In the **ledger** stage, type a claim per **load-bearing field** and toggle its
   **evidence class** (`confirmed` / `reported` / `derived` / `judgment` / `open`)
   and **cite a source**. Watch the gate meter in the rail respond live. A field
   only counts toward the gate when it cites a source and its class is *external*
   — `confirmed`, `reported`, or `derived`. `open` is unsourced; `judgment` is
   your own interpretive call, recorded but never enough to unlock a verdict.
   See **[`docs/ledger-authoring.md`](docs/ledger-authoring.md)** for the
   evidence-class decision table and copyable minimal / passing / failing
   ledgers.
3. The **sourcing gate** unlocks the verdict once **three** fields are sourced.
   Below that you get the pull-list instead — by design.
4. Read the **contamination bucket** (clean / mixed / circular) with its sourced
   reasons, and the **verdict card** with its "what would clear it" line.
5. **Export** `report.md`, `report.json`, or `source-ledger.csv` — all generated
   locally in your browser.

Prefer to drive it from a model? The ledger stage has a **Bring your own model**
panel (copy the neutral retrieval prompt, paste a ledger back), or use the MCP
server / skill — see **[Call it from your own AI](#call-it-from-your-own-ai)**.

## The four-layer workflow

1. **Retrieval.** Neutral, mechanical, object-scoped. No verdict language.
2. **Ledger.** Claim / source / evidence class / confidence — the mating surface.
3. **Analysis.** Object gate, sourcing gate, contamination bucket, verdict.
4. **Publication.** Remove unsupported intent, preserve sourced structure.

Retrieval must be **neutral, mechanical, and object-scoped**: collect the nodes
(investors, board roles, validators, rankings, co-investors, affiliations)
before you classify the structure. A loaded request — "find the shady network
behind X" — is rewritten into neutral retrieval, never refused or stripped of
named public nodes.

## Three modes (in the static app)

- **Manual** — fill the ledger forms directly.
- **LLM-assisted** — the site generates a neutral retrieval prompt; you run it
  in the model of your choice and paste the ledger JSON back.
- **Adapter** — a developer wires a provider that fills the same ledger schema
  (`app/src/lib/adapters/`). The public demo never executes paid model calls.
  See **[`docs/adapter-developer-guide.md`](docs/adapter-developer-guide.md)** for
  the contract, a provider skeleton, and the security checklist.

## Call it from your own AI

The method is split from the UI, so you can run it straight from a frontier
model. Two doors, both self-deploy, both reusing the exact gate functions in
`app/src/lib/`:

### MCP server — the universal connector (recommended)

Plug it into any MCP-capable client (Claude Desktop, Claude Code, Cursor, …).
Your model does the retrieval; **the gates run in code**, so it can't freehand a
verdict past the sourcing gate.

```bash
cd mcp
npm install
```

Then add to your client config (Claude Desktop shown):

```json
{
  "mcpServers": {
    "capability-claim-test": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/TO/axm-capability-claim-test/mcp/server.ts"]
    }
  }
}
```

Full instructions and the tool list: [`mcp/README.md`](mcp/README.md).

### Agent Skill — zero install (Claude)

Drop [`skill/capability-claim-test/`](skill/capability-claim-test/SKILL.md) into
your skills folder. The model follows the four-layer method and emits
schema-valid ledger JSON. No runtime.

## The gates (enforced in code)

- **Object gate** routes you before any seams render — a capital allocator can
  never be forced through the product-company instrument.
- **Sourcing gate** blocks the verdict until **three load-bearing fields are
  sourced**. Below that, the only output is object type, route, known evidence,
  missing fields, and a copyable neutral pull-list.
- **Contamination** renders as a **bucket with source-backed component reasons,
  never a bare number**.
- Every verdict carries its **falsification line** — what would clear it — or it
  is not finished.

Object types: `product_company`, `capital_allocator`, `integrator_platform`,
`ranking_validator_media`, `government_program_vehicle`, `claim_only`.

Verdict states: `A_capability_with_proof`, `B_ahead_of_proof`,
`C_costume_or_proof_substitution`, `unclassifiable`, `not_applicable`.

Contamination buckets: `clean`, `mixed`, `circular`, `insufficient_data`.

## Examples (the regression principle)

The tool is not built to convict; it is built to keep the evidence inside the
claim, and to prove it can **acquit, classify, or refuse to verdict**:

| Button | Behavior |
|---|---|
| Load Example: Cleared Capability | **Acquit** — A / Clean |
| Load Example: Circular / Unproven | **Classify** — C / Circular |
| Load Example: Insufficient Ledger | **Refuse to verdict** — pull-list only |
| Load Example: Capital Allocator / Insufficient Attribution Ledger | **Refuse + route** — attribution fields, not product seams |

See [`docs/regression-suite.md`](docs/regression-suite.md) for the three trap
columns (deference, innuendo, scope) and the loaded-request sanitization test.

## Limitations (what it does *not* do)

Read this before trusting an output. The tool is a method, not an oracle:

- **It does not find facts.** It retrieves nothing on its own. Every fact comes
  from you or a model you run; the page only structures and gates what it's given.
- **It does not verify sources.** It checks that a cited source *id resolves*
  inside your ledger — not that the source is real, authentic, or says what the
  claim says. Garbage sources in, gated garbage out.
- **It is not an allegation of wrongdoing.** "Contamination" means **structural
  dependency / circularity in the proof or validation** — e.g. a company's
  validators are funded by its own backers — **not** fraud, illegality, or moral
  judgment. A `circular` bucket is a statement about proof structure, full stop.
- **It does not establish legal conclusions.** No output is a finding of fact,
  liability, or criminal conduct.
- **Three sourced fields is a procedural floor, not proof of truth.** Passing the
  sourcing gate means you have enough *externally anchored* fields to attempt a
  classification — not that the claim is true.
- **Output quality tracks ledger quality.** A lazily built ledger (weak sources,
  inflated evidence classes, placeholder citations) yields a confident-looking
  report that isn't earned. See [`docs/ledger-authoring.md`](docs/ledger-authoring.md).
- **Scope is the public, structural record.** It is not built for private-life
  dossiers on individuals; loaded "find the dirt on X" requests are rewritten
  into neutral, object-scoped retrieval, never into a private profile.
- **The worked examples are synthetic** regression fixtures, not real diligence.

## Privacy & data handling

- **No backend, no API keys, no telemetry in the page.** The static app holds no
  secrets and calls no server of ours. The method runs entirely in your browser.
- **State is in-memory only.** The ledger lives in React state for the session;
  nothing is written to `localStorage` or sent anywhere. Reloading the tab
  discards it — export if you want to keep it.
- **Exports are generated locally.** `report.md`, `report.json`, and
  `source-ledger.csv` are produced by in-browser code and downloaded directly;
  they never transit a server.
- **Your own model is your own exposure.** If you use the LLM-assisted or adapter
  path, whatever you send to that provider is governed by *their* terms — the
  neutral retrieval prompt and any evidence you paste leave your machine for that
  model. The MCP server runs locally and makes no model calls itself.

## Run locally

```bash
npm install
npm run dev        # local workbench
npm run build      # static build into dist/
npm run typecheck  # strict TypeScript
npm test           # vitest suite (gates + the four examples as regression locks)
npm run check      # typecheck + tests — the CI gate
```

Ledger validation uses [zod](https://zod.dev) (`app/src/lib/validateLedger.ts`),
mirroring `schemas/*.json`. The CI gate runs `npm run check` before every Pages
deploy, so a broken build never ships.

Deploys to GitHub Pages via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
on push to `main`. The Vite `base` defaults to `/axm-capability-claim-test/`;
override with `VITE_BASE` for a custom domain.

## Repository map

```
app/        Vite + React + TypeScript static workbench
  src/lib/  the method: object gate, sourcing gate, contamination, verdict
  src/data/ object routes, load-bearing fields, contamination components, seams
schemas/    the data contract (ledger.schema.json is the mating surface)
prompts/    neutral pull, ledger builder, audit run, publication check
docs/       the method, doctrines, and regression suite
examples/   four worked examples (acquit / classify / refuse x2)
mcp/        MCP server — call the method from any frontier client
skill/      Agent Skill — zero-install door for Claude
```

## License

MIT — see [LICENSE](LICENSE).

---

*Output is a structural assessment, not an allegation of wrongdoing. Every
verdict carries its evidence classification and its falsification line, or it is
not finished.*
