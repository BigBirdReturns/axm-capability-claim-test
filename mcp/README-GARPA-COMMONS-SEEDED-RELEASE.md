# GARPA Commons-seeded release MCP

```bash
npx tsx garpa-commons-seeded-release-server.ts
```

Tools:

- `validate_garpa_commons_seeded_release`
- `run_garpa_commons_seeded_release`

The server recomputes the complete publication-ready chain, generates the exact required R1 files, verifies each UTF-8 byte length and SHA-256 digest, and delegates to the existing release verifiers. It does not establish public release, registry currency, deployment authority, or unrestricted equivalence.
