# GARPA Commons-seeded preflight

This stage binds readiness to one exact admitted as-built receipt before any test run may begin.

```text
admitted Commons-seeded as-built receipt
  + frozen qualification scenarios
  + exact fixture configuration
  + exact instrumentation and calibration state
  + trained operator assignments
  + venue and activity authority
  + hazard, clock, storage, and abort controls
  + unique run reservations
  -> preflight gate
  -> reserved target execution
```

Preflight is not a reusable checklist. The receipt carries the exact as-built digest, build-manifest digest, qualification-contract digest, fixture state, instrument versions and configurations, storage paths, clock source, operator roles, authorization scope, hazard controls, and run identifiers. Any change to those coordinates invalidates the receipt.

Every qualification fixture must be ready with an immutable configuration digest and evidence. Every frozen instrument must match the exact model or version, carry a preflight configuration digest, retain the frozen calibration state and storage path, and prove that the raw-data destination is writable. The shared clock policy must cover every frozen instrument.

Every architecture human role requires a named trained actor who acknowledges the complete responsibility and authority boundary. Every qualification authorization must preserve the exact permitted and prohibited activity scope. Applicable hazards must be controlled, and every frozen abort authority must be able to exercise a tested abort path.

At least one globally unique run identifier is reserved for every frozen scenario. A reservation is valid only under the exact preflight digest. It cannot be reused after the installed build, fixture, instrumentation, operator, authority, storage, clock, or hazard boundary changes.

The following claims remain structurally false:

```text
qualificationTransferred   = false
missionEquivalenceClaimed  = false
```

A passing preflight permits execution of the reserved target run only. It does not constitute a test result, qualification result, deployment result, vendor-parity result, publication claim, or mission-equivalence claim.
