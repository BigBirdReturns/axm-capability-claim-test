# GARPA Commons-seeded preflight

This stage binds an admitted Commons-seeded as-built receipt to the exact readiness state required for one or more reserved target runs.

```text
admitted as-built receipt
  + frozen qualification scenarios
  + exact fixture configuration
  + build-manifest instrumentation configuration
  + qualification instrument identity, calibration, storage, and clock source
  + trained operator assignments
  + exact venue and activity authority
  + explicit hazard determination
  + tested abort path
  + unique run and reservation identifiers
  + immutable readiness evidence
  -> Commons-seeded preflight gate
  -> ordinary preflight gate
  -> reserved target execution only
```

The Commons gate recomputes the as-built predecessor and verifies every source-specific and target-specific readiness assertion. Instrument checks must preserve both the build-manifest configuration digest and the qualification identity, calibration state, storage path, and clock source. Numeric clock skew must remain inside the frozen limit. Every satisfied authorization requires an authority reference. Passive scenarios still require an explicit `not_applicable` hazard determination with evidence.

Readiness evidence cannot postdate preflight. Fixture verification, abort testing, and run reservation must occur after assembly completion and no later than preflight. Run identifiers and reservation-receipt identifiers must both be unique.

After those checks, the stage delegates terminal authority to the existing `runPreflightGate`. That gate remains authoritative for current manifest and qualification digests, assembled build state, material-deviation closure, and the complete readiness vector.

A passing result authorizes only the exact reserved runs. It is not a test result, qualification result, mission-adequacy finding, vendor-parity result, deployment authority, or publication authority. Any change to the as-built identity or readiness boundary invalidates the preflight receipt.
