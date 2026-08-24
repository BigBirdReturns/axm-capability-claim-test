# GARPA Commons-seeded preflight MCP server

Run the dedicated server:

```bash
npx tsx garpa-commons-seeded-preflight-server.ts
```

Tools:

```text
validate_garpa_commons_seeded_preflight
run_garpa_commons_seeded_preflight
```

The server binds readiness to one exact admitted as-built receipt and one frozen qualification contract. It checks fixtures, instrument versions and calibration, storage, clocks, operator training and authority, venue authorization, hazard controls, abort paths, and unique scenario run reservations. A passing result permits only the reserved target execution. It does not produce a test result or claim qualification, deployment fitness, vendor parity, or mission equivalence.
