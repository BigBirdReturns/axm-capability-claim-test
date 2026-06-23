# Adapter developer guide

Adapters are the self-deploy path for teams that want a provider to fill the
same ledger schema the manual UI and MCP server use. The public GitHub Pages demo
does **not** call provider APIs and must not hold paid-model keys. A deployer can
fork the repo, add a provider, and keep secrets in their own runtime.

## What an adapter owns

An adapter turns a neutral retrieval prompt plus optional raw context into a
`Ledger`:

1. Receive `BuildLedgerInput` from the app or your own wrapper.
2. Call your provider in your trusted environment.
3. Return JSON matching `schemas/ledger.schema.json` / `Ledger`.
4. Run `validateLedger` before handing the ledger to `buildReport`.
5. Let the existing object gate, sourcing gate, contamination bucket, and verdict
   renderer do the method work.

Do not put verdict logic in the adapter. The adapter retrieves and structures;
`app/src/lib/` enforces.

## Contract

The TypeScript surface is `app/src/lib/adapters/ProviderAdapter.ts`:

```ts
export interface BuildLedgerInput {
  objectType: ObjectType;
  targetName: string;
  rawContext?: string;
  retrievalPrompt: string;
  schema: object;
}

export interface ClaimAuditProvider {
  name: string;
  buildLedger(input: BuildLedgerInput): Promise<Ledger>;
  reviewReport?(input: ReviewReportInput): Promise<ReportReview>;
}
```

`MockAdapter.ts` is intentionally boring: it makes no network calls and returns
an empty schema-valid ledger. Use it as the compile-time template, not as product
behavior.

## Minimal provider skeleton

```ts
import type { Ledger } from "../../types/audit";
import type { BuildLedgerInput, ClaimAuditProvider } from "./ProviderAdapter";
import { validateLedger } from "../validateLedger";

export class ExampleProvider implements ClaimAuditProvider {
  name = "example-provider";

  async buildLedger(input: BuildLedgerInput): Promise<Ledger> {
    const responseText = await callYourTrustedBackend({
      prompt: input.retrievalPrompt,
      schema: input.schema,
      rawContext: input.rawContext,
    });

    const result = validateLedger(responseText);
    if (!result.ok || !result.ledger) {
      throw new Error(`Provider returned invalid ledger: ${result.errors.join("; ")}`);
    }

    return result.ledger;
  }
}
```

`callYourTrustedBackend` should live outside the static public demo. For example:

- a private serverless function that holds `OPENAI_API_KEY` / provider secrets;
- an internal service with network allowlists and audit logs;
- a local-only wrapper around an on-prem or local model.

## Required provider prompt behavior

Use `generateNeutralPrompt(ledger)` as the retrieval prompt base. The adapter
should preserve these boundaries:

- retrieval only: no verdict language;
- public structural record only;
- return `sources[]` and `claims[]` matching the schema;
- classify every claim as `confirmed`, `reported`, `derived`, `judgment`, or
  `open`;
- use `judgment` only for interpretation — it will not count toward the sourcing
  threshold;
- do not fabricate source IDs; every `claim.sourceIds[]` entry must resolve to a
  non-blank `sources[].id` record.

## Wiring pattern

The current public UI exposes manual and paste-import flows. For a self-deploy,
add a provider control that follows this shape:

```ts
const provider = new ExampleProvider();
const scaffold = {
  schemaVersion: 1,
  objectType: ledger.objectType,
  targetName: ledger.targetName,
  sources: [],
  claims: [],
};

const producedLedger = await provider.buildLedger({
  objectType: ledger.objectType,
  targetName: ledger.targetName,
  rawContext: ledger.context,
  retrievalPrompt: generateNeutralPrompt(scaffold),
  schema: ledgerSchemaJson,
});

const validation = validateLedger(producedLedger);
if (!validation.ok || !validation.ledger) {
  // show validation.errors to the operator; do not run analysis
}

const report = buildReport(validation.ledger);
```

Keep provider controls explicit. Do not make the public demo silently call a
paid model; the user should always know when data leaves the browser.

## Optional review pass

`reviewReport` exists for publication checks, not for overriding gates. A review
pass may flag:

- dropped public nodes;
- unsupported intent claims;
- missing source IDs;
- statements that over-upgrade evidence class;
- report language that sounds like wrongdoing rather than structural assessment.

It must not change `sourcingGate.passed`, inject a verdict below threshold, or
replace source-backed reasons with bare assertions.

## Security checklist

Before shipping an adapter-backed deployment:

- [ ] Secrets live only in your trusted runtime, never in static JS.
- [ ] Provider calls are visible to the operator.
- [ ] Returned ledgers pass `validateLedger` before `buildReport` runs.
- [ ] Source IDs are cross-checked and phantom/blank citations fail.
- [ ] `judgment` does not unlock the sourcing gate.
- [ ] Logs do not store sensitive raw context unless your users consent.
- [ ] The UI explains that model-provider data policy governs external calls.

## Testing checklist

Add tests that prove:

- invalid provider JSON is rejected;
- unresolved source IDs fail validation;
- three `judgment` claims do not pass the sourcing gate;
- three external, source-backed claims do pass;
- below threshold, `buildReport` returns a pull-list and no verdict.

The adapter can be provider-specific, but the gates must remain provider-agnostic.
