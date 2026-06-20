# Capability Claim Test — MCP server

**The "connect it to the frontier" door.** Plug this into any MCP-capable
client (Claude Desktop, Claude Code, Cursor, …) and your model can run the
method directly. The model does the retrieval; **the gates run here, in code** —
so it can't freehand a verdict past the sourcing gate.

No API keys live in this server. It rides on whatever model your client is
already running. Self-deploy, local.

## Setup (about 60 seconds)

```bash
git clone https://github.com/bigbirdreturns/axm-capability-claim-test
cd axm-capability-claim-test/mcp
npm install
```

That's it — no build step. `tsx` runs the TypeScript directly.

### Claude Desktop

Edit your config file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add (use the **absolute path** to `mcp/server.ts` on your machine):

```json
{
  "mcpServers": {
    "capability-claim-test": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/TO/axm-capability-claim-test/mcp/server.ts"]
    }
  }
}
```

Restart Claude Desktop. You'll see the tools under the 🔌 menu.

### Claude Code / Cursor / other MCP clients

Point the client at the same command:

```bash
npx tsx /ABSOLUTE/PATH/TO/axm-capability-claim-test/mcp/server.ts
```

(Claude Code: `claude mcp add capability-claim-test -- npx tsx /ABSOLUTE/PATH/.../mcp/server.ts`)

## Tools

| Tool | Layer | What it does |
|---|---|---|
| `generate_retrieval_prompt` | Retrieval | Neutral, object-scoped pull prompt. No verdict language. |
| `sanitize_request` | Retrieval | Rewrites a loaded/accusatory request into neutral retrieval. |
| `describe_object` | Object gate | Route + load-bearing field keys for an object type. |
| `validate_ledger` | Ledger | Validates ledger JSON against the schema. |
| `run_capability_claim_test` | Analysis | Runs object + sourcing gates. Below three sourced fields it **refuses to verdict** and returns a pull-list. At/above, it returns contamination-as-bucket and the verdict with its falsification line. |

## The intended loop

1. Ask your model to audit a public object.
2. It calls `describe_object` and `generate_retrieval_prompt`, then does its own
   sourced retrieval into a ledger.
3. It calls `run_capability_claim_test`. The gates run in code. It gets back a
   report — or a pull-list if the ledger is too thin to verdict.
4. Output is a **structural assessment, not an allegation of wrongdoing.**

The model supplies the intelligence. This server supplies the method.
