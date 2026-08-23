import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  validateClaimPacket,
  validateMissionOutcome,
} from "../app/src/lib/garpa/validateClaimPacket.ts";
import { runGarpaAdmission } from "../app/src/lib/garpa/runGarpaAdmission.ts";
import { validateCapabilityGraph } from "../app/src/lib/garpa/validateCapabilityGraph.ts";
import { runCapabilityGraphGate } from "../app/src/lib/garpa/runCapabilityGraphGate.ts";
import { validateSubstitutionPlan } from "../app/src/lib/garpa/validateSubstitutionPlan.ts";
import { runSubstitutionGate } from "../app/src/lib/garpa/runSubstitutionGate.ts";

const JSON_INPUT = z.union([z.string(), z.record(z.any())]);

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

export function registerGarpaSubstitutionTools(server: McpServer): void {
  server.registerTool(
    "validate_garpa_substitution_plan",
    {
      title: "Validate a GARPA substitution plan",
      description:
        "Validates a GARPA claim packet, mission outcome, capability graph, and substitution plan. Checks exact component and code ids, graph function and interface references, evidence references, compatibility edges, and option coverage references.",
      inputSchema: {
        claimPacket: JSON_INPUT.describe("GARPA claim packet object or JSON string."),
        missionOutcome: JSON_INPUT.describe("GARPA mission outcome object or JSON string."),
        capabilityGraph: JSON_INPUT.describe("GARPA capability graph object or JSON string."),
        substitutionPlan: JSON_INPUT.describe("GARPA substitution plan object or JSON string."),
      },
    },
    async ({ claimPacket, missionOutcome, capabilityGraph, substitutionPlan }) => {
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
      const graph = validateCapabilityGraph(
        capabilityGraph,
        packet.value,
        outcome.value,
      );
      if (!graph.ok || !graph.value) {
        return text(
          JSON.stringify(
            { ok: false, stage: "capability_graph", errors: graph.errors },
            null,
            2,
          ),
        );
      }
      const plan = validateSubstitutionPlan(
        substitutionPlan,
        graph.value,
        packet.value,
      );
      return text(
        JSON.stringify(
          {
            ok: plan.ok,
            stage: "substitution_plan",
            errors: plan.errors,
          },
          null,
          2,
        ),
      );
    },
  );

  server.registerTool(
    "run_garpa_substitution_gate",
    {
      title: "Run the GARPA substitution gate",
      description:
        "Runs GARPA admission, capability-graph admission, and the component-substitution gate. It requires exact component versions, admissible performance and availability evidence, complete essential-function coverage, compatible internal interfaces, bounded custom code, mandatory residuals and falsification tests, and a complete comparison-cost boundary. Passing permits candidate-architecture work only.",
      inputSchema: {
        claimPacket: JSON_INPUT.describe("GARPA claim packet object or JSON string."),
        missionOutcome: JSON_INPUT.describe("GARPA mission outcome object or JSON string."),
        capabilityGraph: JSON_INPUT.describe("GARPA capability graph object or JSON string."),
        expectedMissionOutcomeDigest: z
          .string()
          .min(1)
          .describe("Digest of the current admitted mission outcome."),
        substitutionPlan: JSON_INPUT.describe("GARPA substitution plan object or JSON string."),
        expectedCapabilityGraphDigest: z
          .string()
          .min(1)
          .describe("Digest of the current admitted capability graph."),
      },
    },
    async ({
      claimPacket,
      missionOutcome,
      capabilityGraph,
      expectedMissionOutcomeDigest,
      substitutionPlan,
      expectedCapabilityGraphDigest,
    }) => {
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
      const graph = validateCapabilityGraph(
        capabilityGraph,
        packet.value,
        outcome.value,
      );
      if (!graph.ok || !graph.value) {
        return text(
          JSON.stringify(
            { ok: false, stage: "capability_graph", errors: graph.errors },
            null,
            2,
          ),
        );
      }
      const plan = validateSubstitutionPlan(
        substitutionPlan,
        graph.value,
        packet.value,
      );
      if (!plan.ok || !plan.value) {
        return text(
          JSON.stringify(
            { ok: false, stage: "substitution_plan", errors: plan.errors },
            null,
            2,
          ),
        );
      }

      const admission = runGarpaAdmission(packet.value, outcome.value);
      const graphGate = runCapabilityGraphGate(
        graph.value,
        outcome.value,
        admission,
        expectedMissionOutcomeDigest,
      );
      const substitutionGate = runSubstitutionGate(
        plan.value,
        graph.value,
        graphGate,
        expectedCapabilityGraphDigest,
        packet.value,
      );

      return text(
        JSON.stringify(
          {
            ok: true,
            substitutionBlocked: !substitutionGate.passed,
            admission,
            graphGate,
            substitutionGate,
            nextStage: substitutionGate.passed
              ? "candidate_architecture"
              : undefined,
          },
          null,
          2,
        ),
      );
    },
  );
}
