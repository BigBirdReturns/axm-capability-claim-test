# GARPA capability graph

The capability graph is downstream of an admitted mission outcome and upstream of component selection. It describes functions, interfaces, human roles, dependencies, constraints, and requirement traces without inheriting the vendor's preferred product architecture.

The gate sequence is:

```text
admitted goal -> capability graph -> structural gate -> admitted for substitution
```

## Admission rules

The graph cannot advance when:

- the offering or goal gate remains blocked;
- its mission-outcome digest is stale;
- a mission requirement or success metric lacks a functional trace;
- an essential function is unresolved or orphaned;
- an interface lacks a producer, consumer, external source, or terminal purpose;
- function and interface declarations disagree;
- a human-in-the-loop function lacks a reciprocally linked role;
- an environmental, deployment, resource, governance, or economic constraint set remains unresolved;
- a function requires an authorization boundary but none is stated;
- a required function remains vendor-specific rather than implementation-neutral.

Passing this gate permits component and substitution research. It does not establish that any component exists, that interfaces are compatible, that a build has been assembled, or that the customer outcome has been reproduced.

## Synthetic passing fixture

`examples/garpa-synthetic-observation/` contains a synthetic claim packet, admitted mission outcome, and capability graph for a passive bounded-observation service. The fixture demonstrates full mission trace, reciprocal interfaces, an explicit operator role, complete constraint sets, and a terminal alert output. It is a regression fixture and makes no claim about a real vendor or deployment.
