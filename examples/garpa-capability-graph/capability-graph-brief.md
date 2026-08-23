# GARPA Capability Graph — GARPA-EXAMPLE-0001

## State
- Admission predecessor: admitted_for_decomposition
- Graph gate: admitted_for_substitution
- Substitution planning: admitted
- Mission outcome digest: sha256:site-awareness-mission-v1

## Graph
- Required functions: 4
- Essential functions: 3
- Interfaces: 5
- Requirement traces: 7
- Human roles: 1
- External dependencies: 1

## Essential functions
- f_observe_environment: Observe the admitted environment — Convert the controlled test fixture into a timestamped observation stream.
- f_detect_candidate: Detect the candidate object — Determine whether the admitted test object is present and approaching the marked boundary.
- f_present_notification: Present the notification to the operator — Deliver a time-stamped detection notice to the trained site operator before boundary crossing.

## Gate findings
- None.

## Required next work
- None.

## Boundary
- No component or vendor has been selected by this graph.
- No bill of materials or candidate architecture has been generated.
- Admission means only that the mission can proceed to substitution research.

## Control question
Which essential function should be challenged first because failure there would invalidate the cheapest proposed substitution?
