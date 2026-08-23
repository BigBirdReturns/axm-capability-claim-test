# GARPA mission adequacy evaluation

Mission evaluation consumes validated test-run receipts. It does not infer success from an architecture, build manifest, assembled build, demonstration video, or vendor comparison.

The evaluation scope freezes:

- case identity;
- build digest;
- qualification-contract digest;
- required scenarios;
- essential metrics;
- secondary metrics;
- whether the scope represents the full admitted mission boundary or a narrower slice.

Only `valid` runs matching both frozen digests are admitted. Aborted, invalidated, incomplete, stale-build, and stale-contract runs remain visible as excluded receipts.

## Non-compensatory essential metrics

Essential metrics cannot be averaged against price, speed, convenience, or another successful metric. Any admitted essential-metric failure produces `failed`. Missing or inconclusive essential metrics produce `partial` when some valid evidence exists.

Secondary metrics describe the resulting profile but cannot change an essential failure into a match.

## States

```text
matched
All required scenarios and essential metrics pass across the declared full
mission boundary.

bounded_match
All required scenarios and essential metrics pass inside an explicitly narrower
boundary.

partial
Some valid current evidence exists, but a required scenario or essential metric
is missing or inconclusive.

failed
At least one essential metric fails in an admitted run.

incomparable
Runs exist, but none match the frozen build and qualification-contract digests
or none remain valid.

unassessed
No valid evidence has been supplied.
```

Every result includes a falsification line. A match can be overturned by a failed essential metric or failed independent repetition under the frozen contract. A failure can be overturned only by valid comparable runs covering every required scenario and essential metric.

The synthetic observation fixture correctly evaluates to `bounded_match`. It covers controlled observation and simulated response only. It does not establish physical mitigation, operational field performance, or vendor-system parity.
