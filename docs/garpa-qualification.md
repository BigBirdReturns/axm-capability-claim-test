# GARPA qualification contract

The qualification stage freezes the meaning of mission success before any scored execution exists. It binds the admitted mission outcome and candidate architecture to repeatable scenarios, non-compensatory metrics, instrumentation, comparators, accounting boundaries, venue authority, and refusal rules.

The sequence is:

```text
admitted candidate architecture
    -> frozen scenarios and metrics
    -> instrumentation and comparator custody
    -> accounting and authority boundaries
    -> qualification gate
```

Passing this gate permits build-manifest work. It does not establish that anything has been assembled or that a metric has passed.

## Mission trace and threshold parity

Every mission success metric must map to at least one essential qualification metric. The qualification metric must preserve the mission direction, unit, threshold or range, and baseline. The contract cannot make the test easier after seeing the candidate architecture.

Every essential metric must appear in at least one complete scenario. Scenarios state the fixture, environment, geometry, duration, load, operator posture, permitted intervention, instrumentation, degraded conditions, and exclusions.

## Instrumentation and receipts

Each metric names the instruments and measurement method that produce its result. Instrumentation requires an exact version, clock source, calibration state, data format, and storage path. A scenario must include every instrument required by the metrics it exercises.

Architecture risks and residuals that require qualification must name metric identifiers present in the frozen contract. Missing tests block advancement.

## Comparators and accounting

Mission adequacy requires a customer-requirement comparator across all essential metrics and scenarios. Vendor comparison remains a separate proposition and is not created by a launch claim or unmatched benchmark.

The qualification accounting boundary must use the same currency and evaluation period as the architecture cost envelope and retain every included architecture cost category. Secondary metrics cannot compensate for an essential failure.

## Authority

Controlled-field, operational, or active-effect scenarios require admitted venue authority and an abort path. Passive simulation, replay, and bench scenarios may carry a documented `not_required` determination when the rationale and prohibited activities are explicit.

## Synthetic fixture

`examples/garpa-synthetic-observation/qualification-contract.json` freezes ten passive scored passes, two essential metrics, two versioned instruments, a same-fixture customer-requirement comparator, the complete architecture accounting boundary, and a passive-bench authority determination. It advances only to `admitted_for_build_manifest` and contains no measured result.
