import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  validateClaimPacket,
  validateMissionOutcome,
} from "../app/src/lib/garpa/validateClaimPacket.ts";
import { runGarpaAdmission } from "../app/src/lib/garpa/runGarpaAdmission.ts";
import { renderGarpaRealityBrief } from "../app/src/lib/garpa/renderRealityBrief.ts";

const JSON_INPUT = z.union([z.string(), z.record(z.any())]);

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

export function registerGarpaAdmissionTools(server: McpServer): void {
  server.registerTool(
    "validate_garpa_claim_packet",
    {
      title: "Validate a GARPA claim packet",
      description:
        "Validates the source-addressable GARPA claim packet and optional candidate mission outcome.",
      inputSchema: {
        claimPacket: JSON_INPUT.describe("GARPA claim packet object or JSON string."),
        missionOutcome: JSON_INPUT.optional().describe(
          "Optional GARPA mission outcome object or JSON string.",
        ),
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
        "Runs the offering-evidence and mission-goal gates, returns exact pull-lists and a bounded reality brief, and never emits architecture for a blocked case.",
      inputSchema: {
        claimPacket: JSON_INPUT.describe("GARPA claim packet object or JSON string."),
        missionOutcome: JSON_INPUT.describe("GARPA mission outcome object or JSON string."),
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
}
