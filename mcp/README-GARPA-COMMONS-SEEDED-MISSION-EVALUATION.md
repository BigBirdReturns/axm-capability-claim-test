# GARPA Commons-seeded mission-evaluation MCP

```bash
npx tsx garpa-commons-seeded-mission-evaluation-server.ts
```

Tools:

- `validate_garpa_commons_seeded_mission_evaluation`
- `run_garpa_commons_seeded_mission_evaluation`

The server admits the bounded target mission-evaluation record only after every submitted run is recomputed, bound to the exact target chain, and present unchanged in the delegated custodied evaluation. It does not establish vendor parity, deployment authority, or publication authority.
