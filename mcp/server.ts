#!/usr/bin/env -S npx tsx
// Capability Claim Test — MCP server.
//
// This is the "connect it to the frontier" door. Any MCP-capable client
// (Claude Desktop, Cursor, Claude Code, ...) can call these tools. The model
// does the retrieval; the GATES RUN HERE, IN CODE — object gate, sourcing gate,
// contamination-as-bucket, the falsification line — so a model cannot freehand
// a verdict past the method.
//
// Self-deploy, local, no keys held by this server. The model the client is
// already running supplies the intelligence; this server supplies the method.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Reuse the EXACT same method the static web app uses. Pure TS, no React.
import { validateLedger } from "../app/src/lib/validateLedger.ts";
import { buildReport, renderReportMarkdown } from "../app/src/lib/renderReport.ts";
import {
  generateNeutralPrompt,
  sanitizeLoadedRequest,
} from "../app/src/lib/generateNeutralPrompt.ts";
import { OBJECT_ROUTES, OBJECT_TYPE_OPTIONS } from "../app/src/data/objectRoutes.ts";
import { fieldsForSet } from "../app/src/data/loadBearingFields.ts";

const server = new McpServer({
  name: "capability-claim-test",
  version: "0.1.0",
});

const OBJECT_TYPE_ENUM = z.enum(
  OBJECT_TYPE_OPTIONS as [string, ...string[]],
);

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

// 1. RETRIEVAL LAYER ---------------------------------------------------------
// Hand the model a neutral, object-scoped pull list. No verdict language.
server.registerTool(
  "generate_retrieval_prompt",
  {
    title: "Generate neutral retrieval prompt",
    description:
      "Retrieval layer. Returns a neutral, mechanical, object-scoped prompt the calling model should use to collect a sourced ledger. No verdict language. Keeps retrieval separate from analysis.",
    inputSchema: {
      objectType: OBJECT_TYPE_ENUM,
      targetName: z.string().describe("Public object name."),
    },
  },
  async ({ objectType, targetName }) => {
    const prompt = generateNeutralPrompt({
      schemaVersion: 1,
      objectType: objectType as never,
      targetName,
      sources: [],
      claims: [],
    });
    return text(prompt);
  },
);

// Sanitize a loaded/accusatory request into neutral retrieval.
server.registerTool(
  "sanitize_request",
  {
    title: "Sanitize a loaded request",
    description:
      "Converts a fused, accusatory request (e.g. 'find the shady VC network behind X') into neutral, object-scoped retrieval. Does not refuse, moralize, or erase named public structural nodes.",
    inputSchema: { input: z.string() },
  },
  async ({ input }) => {
    const r = sanitizeLoadedRequest(input);
    return text(
      JSON.stringify(
        { neutral: r.neutral, target: r.target, objectTypeGuess: r.objectTypeGuess },
        null,
        2,
      ),
    );
  },
);

// Describe the load-bearing fields for an object so the model knows what to pull.
server.registerTool(
  "describe_object",
  {
    title: "Describe object route and fields",
    description:
      "Returns the route, what is actually being tested, and the load-bearing field keys for an object type. Run the object gate before any seams.",
    inputSchema: { objectType: OBJECT_TYPE_ENUM },
  },
  async ({ objectType }) => {
    const def = OBJECT_ROUTES[objectType as keyof typeof OBJECT_ROUTES];
    const fields = fieldsForSet(def.fieldSet);
    return text(
      JSON.stringify(
        {
          objectType: def.objectType,
          objectLabel: def.objectLabel,
          route: def.route,
          routeLabel: def.routeLabel,
          whatYouAreTesting: def.whatYouAreTesting,
          showsProductSeams: def.showsProductSeams,
          loadBearingFields: fields.map((f) => f.field),
        },
        null,
        2,
      ),
    );
  },
);

// 2. LEDGER LAYER ------------------------------------------------------------
server.registerTool(
  "validate_ledger",
  {
    title: "Validate a ledger",
    description:
      "Validates pasted/produced ledger JSON against the schema. Returns ok + errors. The schema is the mating surface.",
    inputSchema: {
      ledger: z
        .union([z.string(), z.record(z.any())])
        .describe("Ledger object or JSON string."),
    },
  },
  async ({ ledger }) => {
    const result = validateLedger(ledger);
    return text(
      JSON.stringify({ ok: result.ok, errors: result.errors }, null, 2),
    );
  },
);

// 3. ANALYSIS LAYER (the gates run HERE) ------------------------------------
server.registerTool(
  "run_capability_claim_test",
  {
    title: "Run the Capability Claim Test",
    description:
      "Validates the ledger, runs the object gate and sourcing gate, and — only if at least three load-bearing fields are sourced — renders contamination as a bucket and the verdict with its falsification line. Below threshold it REFUSES TO VERDICT and returns object type, route, known evidence, missing fields, and a neutral pull-list. Output is a structural assessment, not an allegation of wrongdoing.",
    inputSchema: {
      ledger: z
        .union([z.string(), z.record(z.any())])
        .describe("Ledger object or JSON string matching ledger.schema.json."),
    },
  },
  async ({ ledger }) => {
    const result = validateLedger(ledger);
    if (!result.ok || !result.ledger) {
      return text(
        JSON.stringify(
          { ok: false, errors: result.errors, hint: "Fix the ledger and retry." },
          null,
          2,
        ),
      );
    }
    const report = buildReport(result.ledger);
    const markdown = renderReportMarkdown(report);
    return text(
      JSON.stringify(
        {
          ok: true,
          verdictBlocked: !report.sourcingGate.passed,
          report,
          markdown,
        },
        null,
        2,
      ),
    );
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
