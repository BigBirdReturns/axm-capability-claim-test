# GARPA Commons-seeded qualification

This stage freezes a target qualification contract after a Commons-seeded architecture reaches the existing `admitted_for_qualification` state.

```text
seeded-architecture result
  + canonical target mission-outcome digest
  + canonical target architecture digest
  + seeded-component qualification bindings
  + frozen QualificationContract
  -> seed requalification-custody gate
  -> existing qualification validator and gate
```

## Seed requalification custody

Every seeded component receives one binding to its exact Commons catalog object, revision, object digest, target architecture selection digest, architecture risk set, architecture residual set, and source-required requalification work.

Each source-required test must map to target scenarios and target metrics. At least one mapped scenario must exercise every structured target-environment dimension and value. Architecture risks with `requires_test` and residuals with `qualify` must be named by target qualification metrics.

No source run, pass state, calibration state, authorization, or qualification state transfers into the target case.

## Existing qualification gate

The Commons-specific layer does not decide mission-metric coverage, scenario completeness, instrumentation readiness, frozen thresholds, risk and residual test coverage, comparators, accounting boundaries, authorizations, acceptance rules, or contract state. Those remain controlled by `runQualificationGate`.

A passing result reaches `admitted_for_build_manifest`. It does not authorize procurement, assembly, physical execution, deployment, vendor parity, or publication.
