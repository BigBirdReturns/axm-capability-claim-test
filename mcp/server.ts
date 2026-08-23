#!/usr/bin/env -S npx tsx
// Capability Claim Test — MCP server.
//
// Any MCP-capable client can call the same pure TypeScript gates used by the
// static workbench. The model supplies retrieval and candidate structures; the
// code controls object routing, sourcing, admission, and refusal states.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

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
import {
  validateClaimPacket,
  validateMissionOutcome,
} from "../app/src/lib/garpa/validateClaimPacket.ts";
import { runGarpaAdmission } from "../app/src/lib/garpa/runGarpaAdmission.ts";
import { renderGarpaRealityBrief } from "../app/src/lib/garpa/renderRealityBrief.ts";
import { registerGarpaCapabilityTools } from "./garpaCapabilityTools.ts";
import { registerGarpaSubstitutionTools } from "./garpaSubstitutionTools.ts";
import { registerGarpaArchitectureTools } from "./garpaArchitectureTools.ts";

const server = new McpServer({
  name: "capability-claim-test",
  version: "0.1.0",
});

const OBJECT_TYPE_ENUM = z.enum(
  OBJECT_TYPE_OPTIONS as [string, ...string[]],
);

const JSON_INPUT = z.union([z.string(), z.record(z.any())]);

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

server.registerTool(
  "generate_retrieval_prompt",
  {
    title: "Generate neutral retrieval prompt",
    description:
      "Retrieval layer. Returns a neutral, mechanical, object-scoped prompt the calling model should use to collect a sourced ledger. No verdict language.",
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

server.registerTool(
  "sanitize_request",
  {
    title: "Sanitize a loaded request",
    description:
      "Converts a fused or accusatory request into neutral, object-scoped retrieval without erasing named public structural nodes.",
    inputSchema: { input: z.string() },
  },
  async ({ input }) => {
    const result = sanitizeLoadedRequest(input);
    return text(
      JSON.stringify(
        {
          neutral: result.neutral,
          target: result.target,
          objectTypeGuess: result.objectTypeGuess,
        },
        null,
        2,
      ),
    );
  },
);

server.registerTool(
  "describe_object",
  {
    title: "Describe object route and fields",
    description:
      "Returns the route, test proposition, and load-bearing fields for an object type.",
    inputSchema: { objectType: OBJECT_TYPE_ENUM },
  },
  async ({ objectType }) => {
    const definition = OBJECT_ROUTES[objectType as keyof typeof OBJECT_ROUTES];
    const fields = fieldsForSet(definition.fieldSet);
    return text(
      JSON.stringify(
        {
          objectType: definition.objectType,
          objectLabel: definition.objectLabel,
          route: definition.route,
          routeLabel: definition.routeLabel,
          whatYouAreTesting: definition.whatYouAreTesting,
          showsProductSeams: definition.showsProductSeams,
          loadBearingFields: fields.map((field) => field.field),
        },
        null,
        2,
      ),
    );
  },
);

server.registerTool(
  "validate_ledger",
  {
    title: "Validate a ledger",
    description:
      "Validates ledger JSON against the shared schema and returns flat errors.",
    inputSchema: {
      ledger: JSON_INPUT.describe("Ledger object or JSON string."),
    },
  },
  async ({ ledger }) => {
    const result = validateLedger(ledger);
    return text(JSON.stringify({ ok: result.ok, errors: result.errors }, null, 2));
  },
);

server.registerTool(
  "run_capability_claim_test",
  {
    title: "Run the Capability Claim Test",
    description:
      "Validates a ledger and runs the shared object, sourcing, contamination, verdict, and report logic. Below the sourcing threshold it refuses to verdict and returns a pull-list.",
    inputSchema: {
      ledger: JSON_INPUT.describe("Ledger object or JSON string."),
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
    return text(
      JSON.stringify(
        {
          ok: true,
          verdictBlocked: !report.sourcingGate.passed,
          report,
          markdown: renderReportMarkdown(report),
        },
        null,
        2,
      ),
    );
  },
);

server.registerTool(
  "list_replication_strategies",
  {
    title: "List replication strategies",
    description:
      "Returns the frontier-model replication catalog with maturity, composition, cost notes, and mandatory residuals.",
    inputSchema: {},
  },
  async () => text(JSON.stringify(REPLICATION_STRATEGIES, null, 2)),
);

server.registerTool(
  "build_replication_plan",
  {
    title: "Build a frontier replication plan",
    description:
      "Prices only sourced frontier-model deltas, names the remaining frontier residual, and refuses unsourced axes.",
    inputSchema: {
      ledger: JSON_INPUT.describe("Ledger with objectType frontier_model."),
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
      return text(
        JSON.stringify(
          {
            ok: false,
            errors: [
              `Object gate: frontier replication requires frontier_model, got "${result.ledger.objectType}".`,
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
        {
          ok: true,
          planBlocked: false,
          plan: runReplicationPlan(result.ledger),
        },
        null,
        2,
      ),
    );
  },
);

server.registerTool(
  "validate_garpa_claim_packet",
  {
    title: "Validate a GARPA claim packet",
    description:
      "Validates the source-addressable GARPA claim packet and an optional candidate mission outcome.",
    inputSchema: {
      claimPacket: JSON_INPUT,
      missionOutcome: JSON_INPUT.optional(),
    },
  },
  async ({ claimPacket, missionOutcome }) => {
    const packet = validateClaimPacket(claimPacket);
    const outcome = missionOutcome === undefined
      ? undefined
      : validateMissionOutcome(missionOutcome, packet.value);
    return text(
      JSON.stringify(
        {
          ok: packet.ok && (outcome?.ok ?? true),
          claimPacket: { ok: packet.ok, errors: packet.errors },
          missionOutcome: outcome
            ? { ok: outcome.ok, errors: outcome.errors }
            : undefined,
        },
        null,
        2,
      ),
    );
  },
);

server.registerTool(
  "run_garpa_admission",
  {
    title: "Run GARPA offering and goal admission",
    description:
      "Runs the GARPA offering-evidence and mission-goal gates and returns the highest admissible state, pull-lists, and bounded reality brief. It emits no architecture.",
    inputSchema: {
      claimPacket: JSON_INPUT,
      missionOutcome: JSON_INPUT,
    },
  },
  async ({ claimPacket, missionOutcome }) => {
    const packet = validateClaimPacket(claimPacket);
    if (!packet.ok || !packet.value) {
      return text(
        JSON.stringify(
          { ok: false, stage: "claim_packet", errors: packet.errors },
          null,
          2,
        ),
      );
    }
    const outcome = validateMissionOutcome(missionOutcome, packet.value);
    if (!outcome.ok || !outcome.value) {
      return text(
        JSON.stringify(
          { ok: false, stage: "mission_outcome", errors: outcome.errors },
          null,
          2,
        ),
      );
    }
    const admission = runGarpaAdmission(packet.value, outcome.value);
    return text(
      JSON.stringify(
        {
          ok: true,
          admissionBlocked: !admission.passed,
          admission,
          realityBrief: renderGarpaRealityBrief(
            packet.value,
            outcome.value,
            admission,
          ),
        },
        null,
        2,
      ),
    );
  },
);

registerGarpaCapabilityTools(server);
registerGarpaSubstitutionTools(server);
registerGarpaArchitectureTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
