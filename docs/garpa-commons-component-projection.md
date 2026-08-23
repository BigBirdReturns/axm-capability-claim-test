# GARPA Commons component projection

This layer consumes one exact current `component_observation` revision and one target-case `compatibility_admitted` receipt. It projects the observation into the existing `ComponentCandidate` contract without treating a source-case result as target-case evidence.

```text
exact Commons revision
  + target compatibility closure
  + target-only evidence packet
  -> component candidate projection
  -> component_candidate | substitution_ready
```

## Transferable fields

The exact manufacturer, product, model or software version, and immutable source coordinates may be copied from the Commons revision. Target function and interface identifiers come from the target compatibility closure. Source limitations and residuals are carried because omitting them would overstate transferability.

## Withheld fields

The following fields are target-only and remain absent until target evidence is supplied:

- performance envelope and performance evidence;
- license and license evidence;
- price and accounting boundary;
- current availability and lifecycle;
- supplier availability statement;
- security findings;
- operating requirements.

Source-case values in those fields are not defaults, estimates, or substitutions for target evidence.

## Readiness

`component_candidate` means exact identity and target mapping are admitted, but one or more target evidence obligations remain open.

`substitution_ready` requires target performance evidence, target qualification receipts, license closure, operating-requirement evidence, a security review, current availability, and price evidence whenever the target economic boundary requires it. Even then, the object must pass the existing substitution gate. Projection cannot assign `locally_qualified` maturity.

## Control boundary

Projection does not establish target compatibility beyond the exact closure receipt, component performance qualification, function or interface coverage, architecture selection, procurement authority, qualification, execution authority, mission equivalence, vendor parity, or publication authority.
