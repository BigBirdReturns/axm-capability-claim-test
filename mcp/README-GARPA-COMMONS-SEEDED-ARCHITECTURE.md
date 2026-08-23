# GARPA Commons-seeded architecture MCP server

Run locally:

```bash
cd mcp
npm ci
npx tsx garpa-commons-seeded-architecture-server.ts
```

Tools:

```text
validate_garpa_commons_seeded_architecture
run_garpa_commons_seeded_architecture
```

The server preserves exact seeded component custody and delegates candidate-architecture admission to the existing architecture gate. It does not transfer source qualification or authorize physical execution.
