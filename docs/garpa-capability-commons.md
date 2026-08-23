# GARPA capability commons

The capability commons is a projection over verified GARPA releases. It preserves reusable implementation-neutral functions, exact-version component observations, and architecture patterns without converting a case-specific result into universal truth.

The admission path is:

```text
current verified release
  -> commons request validation
  -> maturity and scope gate
  -> admitted primitive, component observation, or architecture pattern
```

Superseded and withdrawn releases remain available as historical evidence, but they cannot seed the current commons. A later current release may re-admit a revised object with preserved lineage.

## Capability primitives

A primitive records a reusable function and interface pattern. Every primitive carries its source cases and releases, operating constraints, human roles, observed implementations, qualification references, maturity, residuals, and falsification conditions.

Maturity is earned as follows:

```text
concept          structured function and interface proposition
candidate        versioned implementation or qualification candidate
bench_observed   complete E2-or-higher qualification reference
field_observed   complete E3-or-higher qualification reference
repeated         complete qualifying references from at least two distinct cases,
                 including an explicit repeated result
```

A primitive with no residual or falsification condition is blocked regardless of maturity.

## Component observations

A component observation identifies an exact product and model or software version. It binds function and interface roles to one fixture, environment, execution class, metric set, run custody, limitations, residuals, source case, source release, and release digest.

`locally_observed` requires a valid local run at E1 or higher. `locally_qualified` requires complete measured metrics, run custody, and E2 or higher. These states do not qualify the component outside the released fixture and environment.

## Architecture patterns

An architecture pattern identifies recurring function and interface roles, one or more versioned implementations, applicable constraints, failure modes, residuals, and source lineage. Pattern admission accelerates future decomposition. It never bypasses component evidence, compatibility, architecture, or qualification gates in the new case.

## Partial admission

A request may contain both valid and blocked objects. Valid objects remain explicitly listed as admitted while blocked objects retain exact findings and corrective actions. The request-level `passed` field is true only when every submitted object is admitted.

## Synthetic fixture

`examples/garpa-commons/` projects one synthetic bench-observed primitive, one exact-version locally qualified component observation, and one architecture pattern from `GARPA-PUBLICATION-0001-R1`. The release digest and all fixture identifiers are synthetic. No real vendor or product is evaluated.

The control question is whether a future case can reuse the object while retaining the exact version, fixture, environment, evidence state, residual, and requalification boundary that earned it.
