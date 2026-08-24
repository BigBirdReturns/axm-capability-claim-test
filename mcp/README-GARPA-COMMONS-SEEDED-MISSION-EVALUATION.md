# GARPA Commons-seeded mission-evaluation MCP

```bash
npx tsx garpa-commons-seeded-mission-evaluation-server.ts
```

Tools:

- `validate_garpa_commons_seeded_mission_evaluation`
- `run_garpa_commons_seeded_mission_evaluation`

The server validates and evaluates one typed target campaign. Every submitted test-run request is recomputed and bound to the complete reservation ledger from the governing campaign preflight. The gate preserves failed, aborted, invalidated, incomplete, and excluded executions, verifies frozen valid-run and per-run sample requirements, derives the ordinary mission scope from the exact target chain, and delegates the substantive classification to `evaluateMissionAdequacyWithCustody`.

The MCP layer does not discover evaluator arguments, transfer source qualification, establish vendor parity, authorize deployment, or authorize publication.
