# GARPA Commons-seeded build-manifest MCP server

Run locally:

```bash
cd mcp
npm ci
npx tsx garpa-commons-seeded-build-manifest-server.ts
```

Tools:

```text
validate_garpa_commons_seeded_build_manifest
run_garpa_commons_seeded_build_manifest
```

The server binds every Commons-seeded component to its exact source revision, frozen qualification binding, target architecture selection and configuration, manifest component, target qualification regressions, no-substitution policy, calibration or verification work, and assembly steps. It delegates admission to the existing build-manifest gate. A passing result authorizes controlled assembly only and does not establish an as-built state, execution authority, measured result, deployment fitness, parity, publication authority, or equivalence.
