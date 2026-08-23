# GARPA capability-commons MCP server

The commons server admits reusable capability primitives, exact-version component observations, and architecture patterns from one current verified GARPA release.

It exposes:

```text
validate_garpa_commons_admission
run_garpa_commons_admission
```

Run locally:

```bash
cd mcp
npm install
npx tsx garpa-commons-server.ts
```

Example client configuration:

```json
{
  "mcpServers": {
    "garpa-capability-commons": {
      "command": "npx",
      "args": [
        "tsx",
        "/ABSOLUTE/PATH/TO/axm-capability-claim-test/mcp/garpa-commons-server.ts"
      ]
    }
  }
}
```

The server does not search the web or infer missing receipts. The caller supplies a commons request. Validation checks schema and reference integrity. The admission gate then enforces release currency, exact source scope, earned primitive maturity, exact component identity, local-run custody, architecture-pattern support, residuals, falsification conditions, and duplicate identities.

A blocked object remains visible with its reason and required action. Other valid objects in the same request may be admitted, but request-level `passed` is true only when every submitted object passes.

Commons admission does not establish global component qualification, universal substitution, or unrestricted mission equivalence.
