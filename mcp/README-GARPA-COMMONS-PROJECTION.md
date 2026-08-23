# GARPA Commons component projection MCP server

Run the dedicated server with:

```bash
npx tsx garpa-commons-projection-server.ts
```

The server exposes:

```text
validate_garpa_commons_component_projection
run_garpa_commons_component_projection
seed_garpa_commons_projection_into_substitution_plan
```

The projection tools consume one exact current Commons `component_observation` revision, a digest-bound target `compatibility_admitted` receipt, and target-only evidence. They project exact identity and target mappings into the existing `ComponentCandidate` contract while withholding source-case performance, price, availability, license, security, and operating assumptions.

The seed tool requires the original projection request and the supplied projection result. It recomputes the projection, refuses any mismatch, and inserts only a `substitution_ready` candidate into a target plan whose case and capability-graph digest match. It cannot create options, compatibility edges, cost closure, custom code, or architecture state. The existing target substitution gate remains mandatory.
