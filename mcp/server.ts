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
import { REPLICATION_STRATEGIES } from "../app/src/data/replicationStrategies.ts";
import { runReplicationPlan } from "../app/src/lib/runReplicationPlan.ts";
import { runSourcingGate } from "../app/src/lib/runSourcingGate.ts";
import { buildPullList } from "../app/src/lib/renderReport.ts";
import { generateGarpaIntakePrompt } from "../app/src/lib/garpa/generateGarpaIntakePrompt.ts";
import { runGarpaAdmission } from "../app/src/lib/garpa/runGarpaAdmission.ts";
import { validateClaimPacket } from "../app/src/lib/garpa/validateClaimPacket.ts";

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

// GARPA intake: the model extracts a claim packet and mission-outcome proposal;
// the code later decides how far the case is admitted.
server.registerTool(
  "generate_garpa_intake_prompt",
  {
    title: "Generate GARPA intake prompt",
    description:
      "Returns the neutral extraction prompt for an arbitrary capability-offering artifact. The model must separate claimant statements, observed evidence, and the customer mission outcome; it must not select an architecture or issue a verdict.",
    inputSchema: { targetHint: z.string().optional() },
  },
  async ({ targetHint }) => text(generateGarpaIntakePrompt(targetHint)),
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

server.registerTool(
  "validate_claim_packet",
  {
    title: "Validate a GARPA claim packet",
    description:
      "Validates a versioned capability-offering claim packet. Cross-checks artifact, evidence-cell, claim, and conflict references and refuses claimant-controlled prose as measured performance or independent verification.",
    inputSchema: {
      claimPacket: z
        .union([z.string(), z.record(z.any())])
        .describe("GARPA claim packet object or JSON string."),
    },
  },
  async ({ claimPacket }) => {
    const result = validateClaimPacket(claimPacket);
    return text(JSON.stringify({ ok: result.ok, errors: result.errors }, null, 2));
  },
);

server.registerTool(
  "run_garpa_admission",
  {
    title: "Run GARPA admission",
    description:
      "Compiles an attribution-safe capability_offering ledger, runs the ordinary sourcing gate, then applies the stricter offering-evidence and mission-goal gates. Returns the furthest admitted stage and a precise pull-list. It cannot emit an architecture when the actual customer outcome is underspecified.",
    inputSchema: {
      claimPacket: z
        .union([z.string(), z.record(z.any())])
        .describe("GARPA claim packet object or JSON string."),
      missionOutcome: z
        .union([z.string(), z.record(z.any())])
        .optional()
        .describe("Optional mission-outcome object or JSON string."),
    },
  },
  async ({ claimPacket, missionOutcome }) =>
    text(JSON.stringify(runGarpaAdmission(claimPacket, missionOutcome), null, 2)),
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

// 4. FRONTIER ROUTE ----------------------------------------------------------
// The replication catalog: how sourced frontier deltas are priced with open
// tools / lesser-model compositions. Reference data — no gate needed to read it.
server.registerTool(
  "list_replication_strategies",
  {
    title: "List replication strategies",
    description:
      "Returns the replication catalog for the frontier_model route: compositions of open tools and lesser models that price frontier capability axes, each with its maturity (established / reported / experimental) and its MANDATORY residual — what the composition does not give back. Experimental entries are leads, never prices.",
    inputSchema: {},
  },
  async () => text(JSON.stringify(REPLICATION_STRATEGIES, null, 2)),
);

server.registerTool(
  "build_replication_plan",
  {
    title: "Build a frontier replication plan",
    description:
      "Frontier route analysis. Takes a frontier_model ledger and — only if the sourcing gate passes — prices each SOURCED capability delta with open/lesser compositions (residuals carried verbatim), names sourced axes with no pricing-grade composition as the frontier residual, and REFUSES TO PRICE axes whose delta is unsourced. Below three sourced axes it returns the pull-list instead. The plan prices only sourced deltas — it never turns a launch claim into an engineering roadmap.",
    inputSchema: {
      ledger: z
        .union([z.string(), z.record(z.any())])
        .describe("Ledger object or JSON string with objectType 'frontier_model'."),
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
    if (result.ledger.objectType !== "frontier_model") {
      // Object gate: wrong object, wrong test — a company cannot be pushed
      // through the replication instrument.
      return text(
        JSON.stringify(
          {
            ok: false,
            errors: [
              `Object gate: replication plans apply to frontier_model objects only (got "${result.ledger.objectType}").`,
            ],
          },
          null,
          2,
        ),
      );
    }
    const sourcingGate = runSourcingGate(result.ledger);
    if (!sourcingGate.passed) {
      return text(
        JSON.stringify(
          {
            ok: true,
            planBlocked: true,
            sourcingGate,
            pullList: buildPullList(result.ledger),
          },
          null,
          2,
        ),
      );
    }
    return text(
      JSON.stringify(
        { ok: true, planBlocked: false, plan: runReplicationPlan(result.ledger) },
        null,
        2,
      ),
    );
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
