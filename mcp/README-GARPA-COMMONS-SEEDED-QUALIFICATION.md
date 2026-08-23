# GARPA Commons-seeded qualification MCP server

Run locally:

```bash
cd mcp
npm ci
npx tsx garpa-commons-seeded-qualification-server.ts
```

Tools:

```text
validate_garpa_commons_seeded_qualification
run_garpa_commons_seeded_qualification
```

The server binds every seeded component to its exact Commons source, target architecture selection, risks, residuals, and target requalification scenarios and metrics. It delegates admission to the existing qualification gate and does not transfer source results, calibration, authority, qualification, or equivalence.
