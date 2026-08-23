# GARPA execution receipts

The execution layer separates three propositions that marketing and informal build logs routinely collapse:

```text
build manifest   what GARPA intended to assemble
build receipt    what GARPA actually assembled
test run receipt what happened during one frozen execution
```

A candidate architecture and an admitted build manifest do not establish that a system was assembled. An assembled build does not establish that any mission outcome was achieved. A test run supports only the scenario, configuration, metrics, and evidence recorded in that run.

## Build receipt

`BuildReceipt` preserves:

- manifest, architecture, and qualification-contract digests;
- exact installed hardware and software identities;
- code commits and configuration digests;
- executed substitutions;
- material and unsafe deviations;
- actual purchase and service costs;
- actual labor by activity class;
- supporting artifacts;
- the final build digest and state.

An assembled receipt requires a completion time. A substitution must resolve to an installed item. Open material or unsafe deviations remain visible and block test preflight.

## Test run receipt

`TestRunReceipt` preserves:

- the exact build and qualification-contract digests;
- scenario, test, fixture, configuration, and observed environment;
- operators and observers;
- raw data, logs, and observation artifacts;
- metric calculations, exclusions, values, uncertainty, and threshold results;
- every operator intervention;
- anomalies and aborts;
- an immutable result digest and run state.

A measured metric must cite raw sample artifacts held by the run receipt. A valid run cannot contain an invalidating anomaly or abort. An aborted run requires an abort receipt and remains part of case history.

## Preflight gate

`runPreflightGate` refuses execution unless:

- the build receipt references the current manifest;
- the build receipt references the current qualification contract;
- the build state is `assembled`;
- no open material or unsafe deviation remains;
- fixture, instrumentation, calibration, storage, and clocks are ready;
- venue authority, hazard controls, abort custody, operator roles, and run identity are ready.

The gate returns every blocking reason. There is no warning-only bypass.

## Synthetic fixture

`examples/garpa-synthetic-observation/` contains a complete build receipt and one controlled valid test-run receipt. The fixture proves receipt validation, raw-data custody, and preflight behavior without claiming an operational system or vendor equivalence.

The control question is whether a successor can identify the exact thing assembled, reconstruct each measured result from its raw artifacts, and determine why any invalidated or aborted run was excluded from mission evaluation.
