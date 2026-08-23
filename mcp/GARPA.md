# GARPA MCP server

The dedicated server exposes the complete implemented GARPA path without requiring a hosted backend or model API key:

```text
claim packet
  -> offering and goal admission
  -> capability graph
  -> component substitution
  -> candidate architecture
  -> qualification contract
  -> build manifest
  -> build and preflight receipts
  -> test-run receipts
  -> custodied mission evaluation
```

The model supplies retrieval and candidate structures. The server runs the shared validators and gates from `app/src/lib/garpa/`.

## Run

```bash
cd mcp
npm install
npx tsx garpaServer.ts
```

Example MCP configuration:

```json
{
  "mcpServers": {
    "garpa": {
      "command": "npx",
      "args": [
        "tsx",
        "/ABSOLUTE/PATH/TO/axm-capability-claim-test/mcp/garpaServer.ts"
      ]
    }
  }
}
```

## Execution custody

A test run is not admitted into mission evaluation merely because its own receipt is structurally valid. `evaluate_garpa_mission_with_custody` requires a matching preflight receipt that:

- identifies the same case and run;
- identifies the same build and qualification contract;
- records a passing preflight gate;
- predates execution.

Runs without that custody chain are excluded and the evaluation becomes `incomparable` when no admissible run remains.

The non-custodied evaluation tool remains available for inspecting historical or incomplete evidence, but it does not satisfy the full GARPA execution chain.
