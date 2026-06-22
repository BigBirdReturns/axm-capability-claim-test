# Capability Claim Test — Master Specification

**A static claim-audit workbench for turning public field data into a sourced capability and contamination report.**

> Bring your own sources. Bring your own model. The method enforces the ledger.

The name is the **Capability Claim Test**, which travels across defense,
healthcare AI, sovereign AI, procurement, and capital allocators without
reading as weapons-instructional.

## What it is

A static GitHub Pages instrument, not an AI app. The user supplies field data,
optionally uses their own LLM to structure it, pastes the structured output
back into the page, and the site produces the report. **The schemas are the
mating surface. The page does not know the truth. It enforces the method.**

Three modes: **Manual** (fill the forms), **LLM-assisted** (generate a neutral
retrieval prompt, paste the ledger back), **Adapter** (a developer fills the
same ledger schema automatically). The public demo never executes paid model
calls; seamless API calls are a self-deploy.

Beyond the page, the same method is exposed two more ways so it can be called
from a frontier model directly: an **MCP server** (`mcp/`) and an **Agent
Skill** (`skill/`). Both reuse the exact gate functions in `app/src/lib/`.

## The method (Field Card v2)

- **Step 0 — Object gate.** Wrong object, wrong test. See `object-gate.md`.
- **Step 1 — Sourcing gate.** No verdict below three sourced load-bearing
  fields. See `sourcing-gate.md`.
- **Step 2 — Posture.** Forensic analyst, not chaperone, not prosecutor.
  Falsifiable both ways; baseline before verdict; classify every claim;
  structural not behavioral; no manufactured culprit; symmetry.
- **Step 3 — One line.** Separate survivability proof from operating proof,
  then ask how independent the survivability proof is.
- **Step 4 — Two axes.** Operating proof (A/B/C/unclassifiable) × capital
  contamination (clean/mixed/circular). Read the cell, not the letter.
- **Step 5 — Seams.** Ten for a product company; swap to attribution for an
  allocator.
- **Step 6 — Contamination.** A bucket with reasons, never a bare number. See
  `contamination.md`.
- **Step 7 — Trace to roots.** Who supplies belief, who retains value.
- **Step 8 — Verdict.** Object/route, sourcing status, operating proof, capital
  contamination, largest gap, tense of proof, evidence table, falsification
  line, roots, next pulls.

## Governing doctrines

- **Protects evidence, not status.** Role claims need role evidence; intent
  needs intent evidence; wrongdoing needs wrongdoing evidence. See
  `evidence-not-status.md`.
- **Retrieval and analysis are separate layers.** See
  `retrieval-verdict-separation.md`.
- **The object-scope boundary.** Public capacities only; no private dossiers.
- **The exclusion-ledger method** for sensitive or leaked sources.

## The regression principle

The tool is not built to convict. It is built to keep the evidence inside the
claim, and to prove it can **acquit, classify, or refuse to verdict**. See
`regression-suite.md`.

## Enforced-in-code rules

- The sourcing gate blocks the verdict panel until three load-bearing fields
  are sourced by external evidence (`confirmed`, `reported`, or `derived`);
  `judgment` is preserved as analysis but does not unlock the gate. Before that,
  output is object type, route, known evidence, missing fields, and a copyable
  neutral pull-list.
- Contamination renders as a bucket with source-backed component reasons,
  never as a bare number.
- The object gate routes the user before any seams render.

---

*Capability Claim Test. Output is a structural assessment, not an allegation of
wrongdoing. Every verdict carries its evidence classification and its
falsification line, or it is not finished.*
