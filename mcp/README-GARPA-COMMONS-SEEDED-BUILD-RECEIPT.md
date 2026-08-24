# GARPA Commons-seeded as-built receipt MCP server

Run the dedicated server:

```bash
npx tsx garpa-commons-seeded-build-receipt-server.ts
```

Tools:

```text
validate_garpa_commons_seeded_build_receipt
run_garpa_commons_seeded_build_receipt
```

The server treats the frozen build manifest as an expected state and the as-built receipt as a separate evidence object. Passing means the exact assembled target has sufficient identity, configuration, calibration, assembly, cost, labor, and artifact custody to enter target preflight. It does not authorize a test run or claim qualification or mission equivalence.
