# GARPA Commons-seeded architecture

This stage binds an admitted Commons-seeded substitution plan to a target `CandidateArchitecture`, preserves exact seeded component custody, and delegates substantive admission to the existing architecture gate.

```text
seeded-substitution result
  + exact result digest
  + canonical substitution-plan digest
  + target CandidateArchitecture
  -> seed-selection custody gate
  -> existing architecture validator and gate
```

## Seed-selection custody

Every seeded component must be selected under the exact target function, interface, and substitution-option mapping. Its architecture configuration must identify the exact target model or version and any firmware or software version carried by component projection.

Removing, remapping, or changing a seeded component requires rerunning component projection and seeded substitution.

## Existing architecture gate

The Commons-specific layer does not decide option completeness, target compatibility selection, human roles, external dependencies, cost categories, schedule phases, high-consequence risks, residual custody, or state transition. Those remain controlled by `runArchitectureGate`.

A passing result reaches `admitted_for_qualification`. It does not transfer source qualification or authorize procurement, building, testing, deployment, mission equivalence, vendor parity, or publication.
