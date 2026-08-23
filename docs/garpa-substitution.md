# GARPA substitution gate

The substitution stage begins only after an implementation-neutral capability graph passes its structural gate. It evaluates exact component versions, custom code, compatibility edges, function coverage, availability, price observations, and the accounting boundary required to compare a candidate composition with the offering.

The sequence is:

```text
admitted capability graph
    -> versioned components and evidence
    -> function substitution options
    -> interface compatibility edges
    -> complete cost boundary
    -> substitution gate
```

Passing this gate permits candidate-architecture work. It does not establish that the system has been assembled, qualified, or shown to satisfy the mission outcome.

## Component admission

A component must preserve:

- exact model or software version;
- function and interface coverage;
- identity evidence bound to that version;
- external or reproduced performance evidence appropriate to its maturity;
- current availability evidence;
- license evidence for software and service components;
- price evidence captured at a stated time;
- operating requirements, limitations, integration requirements, and residuals.

A vendor statement or community report may remain in the packet as a lead. It cannot satisfy a complete substitution option. Bench, field, and local qualification maturities require independent or locally measured evidence rather than self-attestation.

## Interface admission

Every internal capability interface requires a compatibility edge. The edge records the producer and consumer components, evidence, limitations, and the test that could disprove compatibility. `adapter_required` is admissible only when the adapter component or bounded custom code is part of the plan.

Components that are individually plausible but connected through an unknown, experimental, or incompatible edge do not form an admitted system.

## Custom code

Custom code is a first-class component. It must state an exact version, purpose, typed inputs and outputs, complexity, dependencies, test strategy, safety and security properties, and residuals. `research_grade` or unresolved code cannot support a complete candidate option.

## Complete options and cost boundary

Every required essential function needs a complete option with established or reported maturity, a composition, evidence, a mandatory residual, and a falsification test. The cost boundary must state currency and evaluation period, include integration labor and qualification, and preserve admitted price observations for each used component. Zero-price software does not erase integration, operator, or qualification labor.

## Synthetic fixture

`examples/garpa-synthetic-observation/substitution-plan.json` uses three versioned synthetic components to cover passive observation, bounded detection, and operator presentation. Two compatibility edges cover the internal data seams. The fixture includes current synthetic price and availability evidence, complete options, residuals, falsification tests, and a bounded cost comparison. It is a regression fixture and makes no claim about a real product or deployment.
