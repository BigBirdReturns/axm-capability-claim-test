# GARPA

GARPA is the executable capability-replication path built on the Capability Claim Test. It does not begin by copying a vendor architecture. It preserves the offering claim, reconstructs the customer outcome, decomposes the required functions, prices candidate substitutions, freezes qualification, receipts the actual build and tests, and evaluates only the outcome supported by current evidence.

## Implemented path

```text
claim packet
  -> offering evidence gate
  -> mission outcome gate
  -> capability graph gate
  -> component evidence and substitution gate
  -> candidate architecture gate
  -> qualification contract gate
  -> build manifest gate
  -> build receipt
  -> preflight receipt
  -> test-run receipt
  -> custodied mission evaluation
```

The same pure TypeScript functions are used by tests, MCP tools, and the CLI.

## Fastest orientation

The Vectus fixture begins from one claimant-controlled social post:

```text
examples/garpa-vectus/
```

It correctly stops before architecture because the exact offering version, complete operating environment, complete service boundary, time and coverage requirement, success metrics, and numerical baseline remain unresolved.

The synthetic observation fixture exercises the downstream path without claiming operational or vendor equivalence:

```text
examples/garpa-synthetic-observation/
```

Its frozen result is a `bounded_match` for controlled observation and simulated response only.

## CLI

From the `mcp` directory:

```bash
npm install

npx tsx garpaCli.ts admission \
  ../examples/garpa-vectus/claim-packet.json \
  ../examples/garpa-vectus/mission-outcome.json

npx tsx garpaCli.ts preflight \
  ../examples/garpa-synthetic-observation/build-receipt.json \
  ../examples/garpa-synthetic-observation/preflight-request.json

npx tsx garpaCli.ts evaluate \
  ../examples/garpa-synthetic-observation/evaluation-input.json
```

The admission command exits with code `2` when the case is structurally valid but blocked. Validation failure exits `1`. A passing stage exits `0`.

## MCP

Run the dedicated server:

```bash
cd mcp
npx tsx garpaServer.ts
```

See [`mcp/GARPA.md`](mcp/GARPA.md) for configuration and execution-custody behavior.

## Control law

A model may propose artifacts, evidence cells, mission outcomes, functions, components, architectures, and qualification contracts. It cannot admit its own proposal. A build receipt cannot establish mission success. A test-run receipt cannot enter mission evaluation without a matching passing preflight receipt recorded before execution. Essential-metric failures cannot be compensated by price or secondary performance.
