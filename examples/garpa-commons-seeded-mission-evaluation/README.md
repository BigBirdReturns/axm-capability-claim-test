# Commons-seeded mission evaluation example

The executable example is generated deterministically from one admitted Commons-seeded campaign preflight containing ten exact run reservations. The generator issues one immutable test-run request per reservation, recomputes every predecessor and test-run result, binds the complete sorted run ledger into the evaluation envelope, derives the typed ordinary mission scope from the frozen target chain, and delegates the substantive conclusion to `evaluateMissionAdequacyWithCustody`.

The generated files are:

```text
request.json
result.json
receipt.md
status.json
```

The passing synthetic campaign resolves to `seeded_mission_evaluation_admitted` with the ordinary state `bounded_match`. That classification applies only to the frozen controlled target fixture. It does not establish vendor parity, unrestricted mission equivalence, deployment authority, or publication authority.
