# GARPA Commons-seeded test-run custody

This stage binds one exact reserved target execution to the admitted Commons-seeded preflight chain.

```text
admitted Commons-seeded preflight
  + exact reserved run and scenario
  + exact as-built, qualification, fixture, instrument, operator, and configuration custody
  + immutable TestRunReceipt
  + content-addressed raw artifacts
  -> Commons-seeded test-run gate
  -> seeded_test_run_admitted | incomplete | blocked
```

A receipt may coherently preserve a measured pass, measured failure, abort, or invalidation. Receipt admission means the execution record is admissible evidence. It does not mean the mission outcome passed.

## Gate requirements

The gate recomputes the preflight result and its digest, validates the ordinary `TestRunReceipt`, verifies the execution-envelope and run-result digests, and binds the run to the exact target case, as-built receipt, qualification contract, preflight receipt, reservation receipt, scenario, execution configuration, operators, fixture state, observed environment, required metrics, sample counts, and raw artifact ledger.

A run marked valid cannot contain an abort or an anomaly whose disposition invalidates the run. An aborted run must retain an abort receipt. An invalidated run must retain the anomaly that invalidated it. A failed threshold remains a failed threshold and may still form part of an admitted execution receipt.

## Boundary

This stage does not transfer source qualification or support mission equivalence. It does not evaluate mission adequacy, compare a vendor, authorize deployment, or authorize publication. Those propositions remain behind their existing target evaluation, parity, safety, and publication gates.
