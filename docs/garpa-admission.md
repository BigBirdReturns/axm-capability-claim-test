# GARPA admission spine

GARPA begins upstream of architecture. It accepts a versioned claim packet and a candidate mission outcome, then stops at the strongest state the evidence permits.

The admission sequence is:

```text
artifact -> evidence cell -> claim packet -> offering gate -> goal gate
```

The model may propose the packet and outcome. Code validates references and controls admission. A claimant publication may establish that a claim was made, the identity of an offering, or the mechanism the claimant describes. It does not become independent performance or cost evidence merely because the source is primary.

## Evidence target and control

Every evidence cell records two independent questions:

1. What proposition does this artifact support?
2. Who controlled the evidence venue?

This prevents a launch post that says "a fraction of the cost" from satisfying a `cost_observed` field, and prevents a vendor demonstration from satisfying `independent_verification` without an independent venue.

## Offering gate

The first gate requires:

- claimant and offering identity;
- an exact product, service, or system version bound to a version evidence cell;
- the advertised customer outcome;
- a complete operating environment;
- a complete system boundary that includes the material service and labor envelope.

Environment and boundary evidence carry an explicit `scopeCompleteness` state. Partial descriptions remain visible but cannot satisfy admission.

Sensitive claims such as measured performance, deployment, economic baselines, and independent verification are preserved when they are only self-attested, but they are returned as `claimedOnlyFields` and do not advance the case.

## Goal gate

The second gate requires:

- operator;
- protected or affected object;
- problem or threat;
- desired state change;
- operating environment;
- time or coverage boundary;
- at least one falsifiable success metric;
- a baseline for each admitted metric.

Vague terms such as `effective`, `advanced`, `high-performance`, or `a fraction of the cost` are retrieval targets, not acceptance criteria. Numeric metrics require units, boolean and categorical metrics require typed thresholds, and every admitted metric requires a type-compatible baseline.

## First fixture

`examples/garpa-vectus/` captures the Swarmer post as a claimant-controlled source. The fixture correctly establishes the public offering name, advertised outcome, claimed mechanism, and partial service boundary. It remains blocked because the exact version, complete operating environment, complete service boundary, coverage requirement, quantitative metrics, and numerical economic baseline are unresolved.

No architecture, bill of materials, or equivalence claim is emitted by the admission layer.

## Reality brief

`renderGarpaRealityBrief` converts the validated packet, candidate mission outcome, and gate receipts into a bounded Markdown brief. The renderer attributes vendor statements, separates established and claim-only fields, lists unresolved evidence, and states that architecture and capability equivalence remain unassessed. The `run_garpa_admission` MCP tool returns the same brief beside its structured admission result.
