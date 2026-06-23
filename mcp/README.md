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

## Transcript: passing report path

Below is the shape of a normal MCP run. The exact UI varies by client, but the
tool order should look like this.

### 1. User asks for an audit

```text
Audit Example Robotics as a product company. Use public sources only.
```

### 2. Model calls `describe_object`

```json
{
  "objectType": "product_company"
}
```

Representative response:

```json
{
  "objectType": "product_company",
  "route": "operating_proof_contamination",
  "whatYouAreTesting": "Does the capability work",
  "loadBearingFields": [
    "capital_raised",
    "valuation",
    "competed_awards",
    "named_customer",
    "performance_baseline",
    "independent_verification",
    "production_status",
    "ownership_posture"
  ]
}
```

### 3. Model calls `generate_retrieval_prompt`

```json
{
  "objectType": "product_company",
  "targetName": "Example Robotics"
}
```

The model uses the returned neutral prompt to retrieve public structural records.
Retrieval is still the model/client's job; the MCP server does not browse.

### 4. Model calls `validate_ledger`

```json
{
  "ledger": {
    "schemaVersion": 1,
    "objectType": "product_company",
    "targetName": "Example Robotics",
    "sources": [
      { "id": "s1", "title": "Official award notice", "url": "https://example.org/award" },
      { "id": "s2", "title": "Customer deployment announcement", "url": "https://example.org/customer" },
      { "id": "s3", "title": "Independent benchmark report", "url": "https://example.org/benchmark" }
    ],
    "claims": [
      {
        "field": "competed_awards",
        "statement": "Example Robotics received a competed award under a public program.",
        "evidenceClass": "confirmed",
        "sourceIds": ["s1"]
      },
      {
        "field": "named_customer",
        "statement": "A named customer announced a deployment with Example Robotics.",
        "evidenceClass": "reported",
        "sourceIds": ["s2"]
      },
      {
        "field": "performance_baseline",
        "statement": "The benchmark compares Example Robotics against a stated baseline.",
        "evidenceClass": "derived",
        "sourceIds": ["s3"]
      }
    ]
  }
}
```

Expected response:

```json
{
  "ok": true,
  "errors": []
}
```

### 5. Model calls `run_capability_claim_test`

The model passes the same ledger, optionally with `seams`, `contamination`, and
`verdictNotes` if it has completed the analysis layer.

Representative response:

```json
{
  "ok": true,
  "verdictBlocked": false,
  "report": {
    "target": "Example Robotics",
    "sourcingGate": {
      "required": 3,
      "sourcedCount": 3,
      "passed": true
    },
    "verdict": {
      "state": "not_supplied",
      "loop": "open",
      "whatWouldClearIt": "State the falsification line: name the sourced fact that would move this to A."
    }
  },
  "markdown": "# Capability Claim Test — Example Robotics\\n..."
}
```

If the ledger has three external-evidence claims backed by non-blank source records, the gate opens.
If the analysis annotations are missing, the gate still opens but the verdict is
`not_supplied` until the analysis layer is completed.

## Transcript: blocked report path

This is the failure mode you want. The model has not retrieved enough external
evidence, so the code refuses to produce a verdict.

```json
{
  "ledger": {
    "schemaVersion": 1,
    "objectType": "product_company",
    "targetName": "Example Robotics",
    "sources": [{ "id": "s1", "title": "Investor profile" }],
    "claims": [
      {
        "field": "capital_raised",
        "statement": "The capital base appears strategically significant.",
        "evidenceClass": "judgment",
        "sourceIds": ["s1"]
      },
      {
        "field": "valuation",
        "statement": "Valuation not found.",
        "evidenceClass": "open",
        "sourceIds": []
      }
    ]
  }
}
```

Representative `run_capability_claim_test` response:

```json
{
  "ok": true,
  "verdictBlocked": true,
  "report": {
    "target": "Example Robotics",
    "sourcingGate": {
      "required": 3,
      "sourcedCount": 0,
      "passed": false
    },
    "pullList": [
      "Pull the public record for Example Robotics: capital raised — sources, dates, and evidence class.",
      "Pull the public record for Example Robotics: valuation — sources, dates, and evidence class.",
      "Pull the public record for Example Robotics: competed awards — sources, dates, and evidence class."
    ]
  }
}
```

Notice that `judgment` stays visible in the ledger, but it does not count toward
the three-field threshold. The correct next action is retrieval, not a verdict.

## Transcript: loaded request sanitation

If the user asks a fused or accusatory question:

```text
Find the shady VC network behind Example Robotics.
```

The model should call `sanitize_request`:

```json
{
  "input": "Find the shady VC network behind Example Robotics."
}
```

Representative response:

```json
{
  "neutral": "Build a sourced ledger of investors, board roles, validators, rankings, co-investors, and affiliations for Example Robotics.",
  "target": "Example Robotics",
  "objectTypeGuess": "capital_allocator"
}
```

Use the neutral retrieval instruction, then run the same ledger validation and
gate sequence. Do not erase named public nodes; also do not import the user's
accusatory framing into the verdict.
