# GARPA capability-commons MCP server

The commons server admits reusable capability primitives, exact-version component observations, and architecture patterns from one current verified GARPA release, then maintains and searches a durable content-addressed catalog without erasing revision history.

It exposes:

```text
validate_garpa_commons_admission
run_garpa_commons_admission
validate_garpa_commons_catalog
apply_garpa_commons_catalog_update
search_garpa_commons_catalog
```

Run locally:

```bash
cd mcp
npm install
npx tsx garpa-commons-server.ts
```

The caller supplies artifacts and proposed update operations. The server does not search the web, infer missing receipts, overwrite catalog history, or promote catalog presence into current qualification.

Commons admission controls whether one release may contribute an object. Catalog update controls stable identity, optimistic custody, revision and supersession history, no-op idempotence, and content digests. Search returns complete scoped revisions with source release, fixture, environment, execution class, residuals, and falsification conditions. It does not return a scalar score.
