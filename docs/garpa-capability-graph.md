# GARPA capability graph

The capability graph is the first downstream object permitted after the offering and mission goal pass GARPA admission. It describes what the customer outcome requires without selecting the vendor's product categories, commercial components, open-source projects, or a candidate architecture.

The sequence is:

```text
admitted mission outcome -> capability graph -> graph gate -> substitution research
```

A blocked mission outcome does not receive graph analysis. The graph gate returns `admission_not_passed` and stops. A graph bound to a stale mission digest returns `mission_digest_mismatch` and must be regenerated or explicitly migrated.

## Functions

Functions are written as implementation-neutral state changes:

```text
observe the admitted environment
identify the candidate object
present a notification to the operator
preserve a replayable event record
```

Vendor products and subsystem labels may be preserved as `vendor_specific`, but a vendor-specific function cannot remain `required`. The graph must recover the underlying purpose before substitution begins.

Each function records its inputs, outputs, dependencies, automation level, human roles, consequence class, evidence, assumptions, failure modes, and unresolved questions. Manual, decision-support, supervised-automation, and safety-critical functions require an assigned human role. Safety-critical functions additionally require an explicit authorization and abort boundary.

## Requirement traces

Every admitted mission field must trace to at least one required function:

- operator;
- protected or affected object;
- problem or threat;
- desired state change;
- operating environment;
- time and coverage requirement.

Every admitted success metric receives its own `success_metric` trace with the exact metric id. An essential function that does not serve a traced requirement is an orphan and blocks the graph.

## Interfaces and dependencies

Every interface must have a producer and a consumer, or an explicit external endpoint or terminal state. External dependencies and human roles are first-class graph objects. A required function cannot depend on an excluded or optional function, nor on an external dependency marked optional.

Dependency cycles are blocked unless the cycle is explicitly named as a feedback loop with its participating functions, interfaces, and rationale. This distinguishes intentional observation, decision, action, and reassessment loops from accidental circular dependencies.

## Constraint envelope

Substitution research remains blocked until the following sections are complete and free of open questions:

```text
environment
deployment
resources
governance
economic boundary
```

The graph does not need a numerical budget ceiling when none is admitted. It does need a complete accounting boundary so later cost comparisons cannot omit labor, fixtures, services, qualification, or sustainment.

## First passing fixture

`examples/garpa-capability-graph/` contains a synthetic, source-addressable fixed-site awareness case. It passes the offering and goal gates, traces one boolean success metric through four required functions, models one operator and one external fixture, closes all five constraint sections, and reaches `admitted_for_substitution`.

The fixture deliberately stops there. It contains no product recommendation, component list, bill of materials, code architecture, or capability-equivalence claim.
