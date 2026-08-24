# GARPA implemented surface

This branch contains executable contracts and gates through custodied mission evaluation.

```text
claim packet
  -> offering and goal admission
  -> capability graph
  -> component evidence and substitution
  -> candidate architecture
  -> qualification contract
  -> build manifest
  -> build receipt
  -> preflight receipt
  -> test-run receipt
  -> mission evaluation
```

The Vectus fixture remains blocked before architecture. The synthetic observation fixture exercises the downstream chain and reaches `bounded_match` for controlled observation and simulated response only.

The dedicated MCP entrypoint is `mcp/garpaServer.ts`. The bounded CLI is `mcp/garpaCli.ts`.

## Commons-seeded test run

The highest governed stage is `commons_seeded_test_run`. It admits the evidence receipt for one exact reserved execution while preserving pass, fail, abort, invalidation, and incomplete dispositions.

## Commons-seeded mission evaluation

The highest governed stage is `commons_seeded_mission_evaluation`. It admits a bounded target disposition only after the complete known-run ledger and the existing custodied mission-evaluation gate agree.
