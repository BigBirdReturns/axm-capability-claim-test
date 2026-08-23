# GARPA capability decomposition prompt

Use only the admitted claim packet, mission outcome, and evidence cells supplied with the request. Produce a candidate capability graph matching `schemas/garpa/capability-graph.schema.json`.

Rules:

1. Write functions as implementation-neutral verbs describing required state changes. Do not use a vendor, product, component category, trademark, or advertised subsystem as a required function.
2. Trace every mission field and every admitted success metric to one or more required functions.
3. Give every required function explicit inputs, outputs, dependencies, automation level, human roles, consequence class, assumptions, failure modes, and residual questions.
4. Represent people, external services, infrastructure, power, communications, fixtures, and organizational responsibility as explicit roles or external dependencies.
5. Resolve every interface to a producer and consumer, external endpoint, or terminal state.
6. Declare intentional dependency cycles as feedback loops. Do not hide accidental cycles.
7. Preserve environment, deployment, resource, governance, and economic constraints. Mark a section partial or open when the evidence does not close it.
8. Do not select components, write a bill of materials, price an architecture, or claim replication. This stage ends at a graph candidate.
9. Preserve evidence-cell ids on the functions, traces, roles, dependencies, interfaces, and constraint sections they support.
10. Return JSON only.
