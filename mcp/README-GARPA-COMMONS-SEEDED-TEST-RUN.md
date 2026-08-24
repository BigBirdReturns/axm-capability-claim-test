# GARPA Commons-seeded test-run MCP surface

The dedicated server exposes:

```text
validate_garpa_commons_seeded_test_run
run_garpa_commons_seeded_test_run
```

The gate admits a coherent execution receipt for one exact reserved target run. A receipt may preserve a measured pass, measured failure, abort, invalidation, or incomplete run. Receipt admission does not convert any threshold result into mission adequacy, vendor parity, deployment authority, or publication authority.

Run locally with:

```bash
npx tsx garpa-commons-seeded-test-run-server.ts
```
