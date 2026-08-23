# GARPA publication MCP server

This local server converts governed mission and parity states into typed claim candidates, validates a release package, and runs the final publication gate.

## Start

```bash
cd mcp
npm install
npx tsx garpa-publication-server.ts
```

An MCP client can point at:

```text
npx tsx /ABSOLUTE/PATH/TO/axm-capability-claim-test/mcp/garpa-publication-server.ts
```

## Tools

### `compile_garpa_publication_claims`

Compiles deterministic claim candidates from:

```text
mission evaluation state and digest
build receipt digest
frozen scenarios and metrics
mission residuals
admitted run receipt identifiers
vendor parity state and digest
exact vendor version and matched metrics, when parity exists
```

A blocked or missing parity state produces a residual claim rather than a parity claim.

### `validate_garpa_publication_package`

Validates:

```text
claim support coordinates
claim scope
artifact rights
artifact release forms
redactions
safety review
rights review
known and disclosed failures
known and disclosed contradictions
correction contact
upstream receipt references
```

### `run_garpa_publication_gate`

Blocks:

```text
stale upstream receipts
unsupported claims
bounded claims without scenario and metric scope
vendor parity claims without same-fixture match
cost claims without aligned accounting boundaries
omitted failures or contradictions
rights-incompatible artifact release
unsafe public or research audiences
redactions that remove material claim support
```

A passing package returns a public dossier containing admitted claims only. A blocked package returns a block receipt with findings and exact corrective actions.

## Trust boundary

The model may draft claim candidates and package metadata. It cannot mark a claim supported, upgrade parity, align cost boundaries, clear rights, clear safety, erase failure history, or publish through a failed gate.
