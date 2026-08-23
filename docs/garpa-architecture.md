# GARPA candidate architecture

The candidate-architecture stage selects one admissible composition for each required mission function and turns the substitution plan into a versioned system proposal. It records exact component configurations, selected interface paths, human roles, external dependencies, the complete cost and schedule envelopes, high-consequence risks, and every residual inherited from the selected substitutions.

The sequence is:

```text
admitted substitution plan
    -> selected options and exact configurations
    -> complete interface path
    -> staffing and dependency assignments
    -> cost, schedule, risks, and residuals
    -> architecture gate
```

Passing this gate permits qualification planning. It does not establish that the system has been assembled, that an interface works outside its cited evidence, or that the mission outcome has been reproduced.

## Selection rules

Every required essential function needs one selected substitution option with complete candidate coverage and established or reported maturity. Every component and bounded custom-code item required by those options must be selected with a defined configuration. Every internal capability interface requires an admitted compatibility selection, including any adapter or custom code used by that edge.

The architecture must also assign every human role and external dependency declared by the capability graph. Human staffing and institutional services remain part of the system boundary rather than disappearing behind the hardware bill of materials.

## Cost and schedule

The architecture cost envelope requires hardware, software, integration labor, operator labor, qualification, and contingency. Each line carries a range, recurrence, accounting basis, evidence references where available, and confidence. Zero-price software does not erase engineering or operator labor.

The schedule must contain procurement, integration, and qualification phases with explicit owners, predecessors, ranges, and acceptance conditions. Cycles are refused.

## Risk and residual custody

Mission-failure and unsafe risks require either a design mitigation or a named qualification test with mitigation. Selected substitution and component residuals must remain visible in the architecture register. The architecture cannot mark itself `integration_ready` because that state belongs downstream of an admitted qualification contract.

## Synthetic fixture

`examples/garpa-synthetic-observation/candidate-architecture.json` selects the three synthetic observation components, both internal compatibility edges, one operator role, six cost categories, a sequenced schedule, two qualification-bound mission risks, and three scoped residuals. The fixture advances only to `admitted_for_qualification` and makes no assembly, mission-match, or vendor-parity claim.
