import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  validateClaimPacket,
  validateMissionOutcome,
} from "../app/src/lib/garpa/validateClaimPacket.ts";
import { runGarpaAdmission } from "../app/src/lib/garpa/runGarpaAdmission.ts";
import { validateCapabilityGraph } from "../app/src/lib/garpa/validateCapabilityGraph.ts";
import { runCapabilityGraphGate } from "../app/src/lib/garpa/runCapabilityGraphGate.ts";

const JSON_INPUT = z.union([z.string(), z.record(z.any())]);

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

export function registerGarpaCapabilityTools(server: McpServer): void {
  server.registerTool(
    "validate_garpa_capability_graph",
    {
      title: "Validate a GARPA capability graph",
      description:
        "Validates a GARPA claim packet, mission outcome, and implementation-neutral capability graph. Checks schema shape, unique ids, artifact/evidence/function/interface references, mission metric references, human roles, and external dependencies.",
      inputSchema: {
        claimPacket: JSON_INPUT.describe("GARPA claim packet object or JSON string."),
        missionOutcome: JSON_INPUT.describe("GARPA mission outcome object or JSON string."),
        capabilityGraph: JSON_INPUT.describe("GARPA capability graph object or JSON string."),
      },
    },
    async ({ claimPacket, missionOutcome, capabilityGraph }) => {
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
      return text(
        JSON.stringify(
          {
            ok: graph.ok,
            stage: "capability_graph",
            errors: graph.errors,
          },
          null,
          2,
        ),
      );
    },
  );

  server.registerTool(
    "run_garpa_capability_graph_gate",
    {
      title: "Run the GARPA capability-graph gate",
      description:
        "Runs GARPA admission and the implementation-neutral capability-graph gate. It refuses decomposition when the goal is blocked, invalidates stale mission digests, requires full mission trace, reciprocal interfaces, explicit human roles and constraints, and blocks required vendor-specific functions. Passing permits substitution research only; no component or architecture claim is emitted.",
      inputSchema: {
        claimPacket: JSON_INPUT.describe("GARPA claim packet object or JSON string."),
        missionOutcome: JSON_INPUT.describe("GARPA mission outcome object or JSON string."),
        capabilityGraph: JSON_INPUT.describe("GARPA capability graph object or JSON string."),
        expectedMissionOutcomeDigest: z
          .string()
          .min(1)
          .describe("Digest of the current admitted mission outcome."),
      },
    },
    async ({
      claimPacket,
      missionOutcome,
      capabilityGraph,
      expectedMissionOutcomeDigest,
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

      const admission = runGarpaAdmission(packet.value, outcome.value);
      const graphGate = runCapabilityGraphGate(
        graph.value,
        outcome.value,
        admission,
        expectedMissionOutcomeDigest,
      );

      return text(
        JSON.stringify(
          {
            ok: true,
            graphBlocked: !graphGate.passed,
            admission,
            graphGate,
            nextStage: graphGate.passed ? "component_substitution" : undefined,
          },
          null,
          2,
        ),
      );
    },
  );
}
