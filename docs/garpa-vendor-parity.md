# GARPA vendor parity evaluation

Vendor parity is evaluated separately from mission adequacy. GARPA may satisfy a customer outcome inside a frozen boundary while no comparable vendor result exists. Conversely, a vendor may have a measured advantage on one axis even when GARPA remains adequate for the customer decision.

The sequence is:

```text
GARPA mission evaluation
  -> exact vendor version
  -> vendor observations
  -> scenario and fixture comparison
  -> metric comparison
  -> accounting-boundary comparison where cost is claimed
  -> vendor parity evaluation
```

A launch post, datasheet, or provider demonstration can establish that a performance claim was made. Same-fixture parity requires independent or locally measured evidence tied to the exact vendor version.

## Preconditions

A parity attempt requires:

- a GARPA mission state of `matched` or `bounded_match`;
- a frozen GARPA build receipt digest;
- a frozen GARPA qualification contract digest;
- an exact vendor offering version;
- required and essential metric identifiers;
- metric comparators fixed before evaluation;
- GARPA and vendor observations;
- scenario-comparison receipts;
- aligned accounting boundaries when cost is a compared metric.

If GARPA remains `partial`, `failed`, `incomparable`, or `unassessed`, the parity evaluator returns `not_attempted` rather than turning an incomplete mission result into a product comparison.

## Same-fixture requirements

For each required metric, the evaluator requires:

- one GARPA observation bound to the frozen build and qualification digests;
- one vendor observation bound to the exact vendor version;
- a `same_fixture` scenario-comparison record;
- matching fixture digests;
- matching measurement-method digests;
- compatible value types and units;
- independent or locally measured vendor evidence;
- the declared absolute and relative tolerance.

Reported-only, claimant-controlled, or commercially related vendor evidence remains visible but produces `evidence_only_comparison`, not parity.

## Metric comparison

The supported comparator directions are:

```text
higher_is_better
lower_is_better
absolute_delta
boolean_equal
categorical_equal
```

Numeric comparators require a unit. Tolerance is fixed as:

```text
absolute tolerance + |vendor value| × relative tolerance
```

A miss on any required metric produces `same_fixture_miss`. The evaluation reports every matched, missed, missing, and incomparable axis separately so one favorable metric cannot conceal another axis.

## Cost comparison

A cost comparator may set `requiresAccountingAlignment=true`. In that case, parity remains blocked unless the accounting comparison is `aligned` across:

- currency and price date;
- evaluation period;
- mission denominator;
- hardware and software;
- services and communications;
- integration and operator labor;
- qualification and regulatory burden;
- maintenance, spares, replacement, and sustainment;
- exclusions and contingency.

A hardware bill of materials cannot be compared directly with a managed-service price.

## States

```text
same_fixture_match
Every required metric matches under the exact-version, same-fixture contract.

same_fixture_miss
At least one required metric misses under the same fixture.

evidence_only_comparison
Vendor evidence is reported or claimant-controlled rather than independently measured.

vendor_baseline_missing
The exact vendor version or metric observations are absent.

scenario_mismatch
No same-fixture scenario pair exists.

accounting_boundary_mismatch
A cost comparison is requested without aligned accounting boundaries.

incomparable
Metric evidence exists but its unit, fixture, method, version, or custody cannot support comparison.

not_attempted
GARPA has not yet completed a matched or bounded-match mission evaluation.
```

## Reference fixture

`examples/garpa-vendor-parity/parity-case.json` is synthetic. It compares the receipted GARPA passive-observation slice with a fictional independently measured reference system. Detection and operator-presentation latency match under the same fixture and method, producing `same_fixture_match` inside the bounded scenario.

The fixture is not evidence about any real vendor, Vectus, Swarmer, or operational air-defense system. It proves only that the parity gate can admit, miss, refuse, and narrow claims correctly.

## Control question

Can every public parity sentence identify the exact vendor version, GARPA build, qualification contract, same fixture, same method, compared metrics, tolerance, accounting boundary, and residual scope without implying full-system equivalence from a bounded result?
