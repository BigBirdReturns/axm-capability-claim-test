# GARPA Commons component projection

This stage converts an admitted Commons `candidate_input` nomination into a target-case `ComponentCandidate` only after the target case supplies its own exact-version identity, performance, availability, price, and license evidence.

```text
Commons transfer nomination
  + recomputed transfer-result digest
  + target claim packet
  + target ComponentCandidate intent
  -> component projection gate
  -> target candidate seed
```

The source observation remains attached as provenance and constraint context. Its performance, price, availability, licensing, and qualification do not become target-case evidence.

## Admission requirements

A projected candidate must:

- resolve to an admitted `candidate_input` whose source object is an exact component observation;
- retain the source manufacturer, product, exact model or version, and firmware or software version;
- use the exact target function and interface mapping admitted by Commons transfer;
- carry every source residual, limitation, known mismatch, and required requalification test;
- cite target-case `component_identity`, `component_performance`, `component_availability`, and `component_price` evidence for the exact version;
- cite target-case license evidence for software and services;
- claim only a maturity earned by target-case evidence;
- remain in an active target lifecycle.

`locally_qualified` cannot be inherited through projection. Target qualification remains downstream.

## Output boundary

The output is a substitution seed containing target `ComponentCandidate` records, mapped and unmapped functions and interfaces, and required compatibility and qualification work. It deliberately contains no substitution options, compatibility edges, complete cost boundary, architecture, qualification result, procurement authority, test authority, deployment authority, or mission-equivalence claim.
