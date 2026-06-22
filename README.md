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
   only counts when it cites a source and uses an external evidence class
   (`confirmed`, `reported`, or `derived`). `judgment` is preserved, but does not
   unlock the verdict.
3. The **sourcing gate** unlocks the verdict once **three** fields are sourced.
   Below that you get the pull-list instead — by design.
4. Read the **contamination bucket** (clean / mixed / circular) with its sourced
   reasons, and the **verdict card** with its "what would clear it" line.
5. **Export** `report.md`, `report.json`, or `source-ledger.csv` — all generated
   locally in your browser.

Need the ledger shape? Start with [`docs/ledger-authoring.md`](docs/ledger-authoring.md)
for minimal, passing, and failing ledgers, source-ID rules, and the evidence-class
decision table.

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
  sourced** by external evidence (`confirmed`, `reported`, or `derived` with a
  real source). `judgment` and `open` claims do not unlock the verdict. Below
  threshold, the only output is object type, route, known evidence, missing
  fields, and a copyable neutral pull-list.
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

## Limitations

- **Not a fact-finder.** The app does not retrieve facts, verify source
  authenticity, or decide what happened in the world. It only evaluates the
  ledger you provide.
- **Not legal or wrongdoing analysis.** Output is a structural assessment. A
  contamination bucket means proof-dependency or circularity, not misconduct.
- **Three fields is a floor, not proof.** Passing the sourcing gate unlocks the
  analysis layer; it does not prove the underlying capability.
- **Ledger quality controls output quality.** Weak statements, missing dates,
  placeholder citations, or over-upgraded evidence classes produce weak reports.
- **Public structural scope only.** Retrieval is scoped to public capacities and
  public structural records; do not use the method to assemble private dossiers.
- **Examples are illustrative.** The worked examples are synthetic regression
  locks for acquit / classify / refuse behavior, not real diligence files.

## Privacy

- **Static browser app:** no backend, no server-held API keys, and no telemetry in
  the public demo.
- **In-memory state:** audits live in React state while the page is open. The app
  does not write audits to `localStorage`, `sessionStorage`, or IndexedDB.
- **Local exports:** `report.md`, `report.json`, and `source-ledger.csv` are
  generated in your browser and downloaded locally.
- **Bring your own model means bring your own exposure:** if you paste prompts or
  ledgers into an external model or connect the MCP server to a client, that
  provider/client's data policy governs that interaction.

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
