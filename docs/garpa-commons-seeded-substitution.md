# GARPA Commons-seeded substitution

This stage binds an admitted Commons component projection to a complete target-case substitution plan and then delegates substantive admission to the existing substitution gate.

```text
component-projection result
  + exact projection-result digest
  + target SubstitutionPlan
  -> seed-integrity gate
  -> existing substitution validator and gate
```

## Seed custody

Every component admitted by Commons projection must appear in the target plan without mutation. Omission, identity change, evidence change, maturity change, price change, availability change, residual removal, limitation removal, or requalification removal requires a new component-projection result.

Target-only components may be added for uncovered functions. Their identity, performance, license, availability, price, compatibility, options, and costs are evaluated solely against the target claim packet by the existing substitution gate.

## Output boundary

A passing result means the complete target plan reached `admitted_for_architecture` through the existing gate. It does not mean source qualification transferred. It does not select an architecture, authorize procurement or testing, or establish mission equivalence.

An incomplete result preserves the valid plan and exact existing gate findings, including uncovered functions, unresolved interfaces, weak components, unbounded code, or an incomplete cost boundary.
