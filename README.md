# Capability Claim Test

> Bring your own sources. Bring your own model. The method enforces the ledger.

A **static claim-audit workbench** for turning public field data into a sourced
capability and contamination report. It is a static GitHub Pages instrument,
**not an AI app**: the page holds no API keys, calls no backend, and runs the
whole method locally in your browser. **The page does not know the truth. It
enforces the method.**

The output is a **structural assessment, not an allegation of wrongdoing**.

*(Internal method name: the Gun-or-Vehicle Test.)*

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

## Run locally

```bash
npm install
npm run dev        # local workbench
npm run build      # static build into dist/
npm run typecheck  # strict TypeScript
```

Deploys to GitHub Pages via [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
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
