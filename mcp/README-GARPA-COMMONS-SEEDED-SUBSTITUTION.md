# GARPA Commons-seeded substitution MCP server

Run locally:

```bash
cd mcp
npm ci
npx tsx garpa-commons-seeded-substitution-server.ts
```

Tools:

```text
validate_garpa_commons_seeded_substitution
run_garpa_commons_seeded_substitution
```

The server binds an admitted Commons-projected component to a target `SubstitutionPlan`, refuses seed mutation, and delegates the complete plan to the existing substitution gate. It does not transfer source evidence or emit an architecture.
