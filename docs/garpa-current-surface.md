# GARPA implemented surface

This branch contains executable contracts and gates through governed case-registry admission.

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
  -> vendor parity
  -> publication custody
  -> release verification
  -> public registry admission
```

The Vectus fixture remains blocked before architecture. The synthetic observation fixture exercises the downstream chain and reaches `bounded_match` for controlled observation and simulated response only.

The dedicated MCP entrypoint is `mcp/garpaServer.ts`. The bounded CLI is `mcp/garpaCli.ts`.

## Commons-seeded test run

The `commons_seeded_test_run` stage admits the evidence receipt for one exact reserved execution while preserving pass, fail, abort, invalidation, and incomplete dispositions.

## Commons-seeded mission evaluation

The `commons_seeded_mission_evaluation` stage admits a bounded target disposition only after the complete known-run ledger and the existing custodied mission-evaluation gate agree.

## Commons-seeded vendor parity

The `commons_seeded_vendor_parity` stage derives GARPA observations from the complete admitted target campaign, binds the exact vendor version and content-addressed vendor evidence, and preserves the state returned by the existing vendor-parity evaluator.

## Commons-seeded publication

The `commons_seeded_publication` stage derives the complete public claim set from the admitted mission and parity records, requires exact support and limitation custody, and preserves the existing publication gate's ready or blocked state.

## Commons-seeded release verification

The `commons_seeded_release_verification` stage generates and verifies the exact initial R1 candidate bundle, manifest, file hashes, byte lengths, and required public and evidence records without converting bundle integrity into public release or registry authority.

## Commons-seeded public registry

The highest governed stage is `commons_seeded_public_registry`. It admits the exact verified current R1 as the sole governing release inside a deterministic initial case entry, preserves the existing registry gate's concurrency, sequence, lineage, identity, and case-transition rules, and keeps external publication and distribution structurally false.
