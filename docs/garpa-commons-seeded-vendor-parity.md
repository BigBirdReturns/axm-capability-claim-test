# GARPA Commons-seeded vendor parity

This stage compares the complete admitted target campaign with an exact vendor version without allowing a favorable target run or an unversioned vendor claim to stand in for a controlled comparison.

```text
admitted Commons-seeded mission evaluation
  + deterministic GARPA observations derived from every valid campaign run
  + complete frozen qualification metric set
  + exact vendor offering and version
  + content-addressed vendor evidence
  + same-fixture and same-method scenario custody
  + existing vendor-parity request
  -> Commons parity-custody gate
  -> existing vendor-parity evaluator
  -> same_fixture_match | same_fixture_miss | evidence_only_comparison
     | vendor_baseline_missing | scenario_mismatch
     | accounting_boundary_mismatch | incomparable | not_attempted
```

The Commons layer recomputes the complete mission-evaluation result. It derives each GARPA parity observation using the frozen scenario, fixture state, metric method, required run count, and aggregation rule. Caller-selected GARPA observations, omitted qualification metrics, changed essentiality, changed units, or changed comparison directions fail closed.

Vendor observations remain separate evidence. Every submitted vendor evidence reference must resolve to a SHA-256 artifact record captured before parity evaluation. Exact-version absence remains visible as `vendor_baseline_missing`; reported or commercially controlled evidence cannot become same-fixture parity.

A coherent comparison record may be admitted even when the substantive state is a miss, evidence-only comparison, missing baseline, scenario mismatch, accounting mismatch, incomparable, or not attempted. Admission establishes the integrity of the comparison record, not product equivalence.

Vendor-parity admission does not authorize unrestricted equivalence, deployment, or publication. Those propositions remain under their existing downstream gates.
