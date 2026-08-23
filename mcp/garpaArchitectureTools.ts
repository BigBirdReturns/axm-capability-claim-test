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
import { validateCandidateArchitecture } from "../app/src/lib/garpa/validateCandidateArchitecture.ts";
import { runArchitectureGate } from "../app/src/lib/garpa/runArchitectureGate.ts";

const JSON_INPUT = z.union([z.string(), z.record(z.any())]);

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

function validationFailure(stage: string, errors: string[]) {
  return text(JSON.stringify({ ok: false, stage, errors }, null, 2));
}

export function registerGarpaArchitectureTools(server: McpServer): void {
  server.registerTool(
    "validate_garpa_candidate_architecture",
    {
      title: "Validate a GARPA candidate architecture",
      description:
        "Validates the full GARPA chain through candidate architecture: claim packet, mission outcome, capability graph, substitution plan, exact component selections, interface selections, human roles, dependencies, cost and schedule envelopes, risks, and residuals.",
      inputSchema: {
        claimPacket: JSON_INPUT,
        missionOutcome: JSON_INPUT,
        capabilityGraph: JSON_INPUT,
        substitutionPlan: JSON_INPUT,
        candidateArchitecture: JSON_INPUT,
      },
    },
    async ({
      claimPacket,
      missionOutcome,
      capabilityGraph,
      substitutionPlan,
      candidateArchitecture,
    }) => {
      const packet = validateClaimPacket(claimPacket);
      if (!packet.ok || !packet.value) return validationFailure("claim_packet", packet.errors);
      const outcome = validateMissionOutcome(missionOutcome, packet.value);
      if (!outcome.ok || !outcome.value) return validationFailure("mission_outcome", outcome.errors);
      const graph = validateCapabilityGraph(capabilityGraph, packet.value, outcome.value);
      if (!graph.ok || !graph.value) return validationFailure("capability_graph", graph.errors);
      const plan = validateSubstitutionPlan(substitutionPlan, graph.value, packet.value);
      if (!plan.ok || !plan.value) return validationFailure("substitution_plan", plan.errors);
      const architecture = validateCandidateArchitecture(
        candidateArchitecture,
        graph.value,
        plan.value,
        packet.value,
      );
      return text(
        JSON.stringify(
          {
            ok: architecture.ok,
            stage: "candidate_architecture",
            errors: architecture.errors,
          },
          null,
          2,
        ),
      );
    },
  );

  server.registerTool(
    "run_garpa_architecture_gate",
    {
      title: "Run the GARPA candidate-architecture gate",
      description:
        "Runs every GARPA gate through candidate architecture. It requires admitted substitution options, exact selected configurations, complete compatibility paths, staffing and dependencies, full cost and schedule envelopes, controlled high-consequence risks, and carried residuals. Passing permits qualification planning only.",
      inputSchema: {
        claimPacket: JSON_INPUT,
        missionOutcome: JSON_INPUT,
        capabilityGraph: JSON_INPUT,
        expectedMissionOutcomeDigest: z.string().min(1),
        substitutionPlan: JSON_INPUT,
        expectedCapabilityGraphDigest: z.string().min(1),
        candidateArchitecture: JSON_INPUT,
        expectedSubstitutionPlanDigest: z.string().min(1),
      },
    },
    async ({
      claimPacket,
      missionOutcome,
      capabilityGraph,
      expectedMissionOutcomeDigest,
      substitutionPlan,
      expectedCapabilityGraphDigest,
      candidateArchitecture,
      expectedSubstitutionPlanDigest,
    }) => {
      const packet = validateClaimPacket(claimPacket);
      if (!packet.ok || !packet.value) return validationFailure("claim_packet", packet.errors);
      const outcome = validateMissionOutcome(missionOutcome, packet.value);
      if (!outcome.ok || !outcome.value) return validationFailure("mission_outcome", outcome.errors);
      const graph = validateCapabilityGraph(capabilityGraph, packet.value, outcome.value);
      if (!graph.ok || !graph.value) return validationFailure("capability_graph", graph.errors);
      const plan = validateSubstitutionPlan(substitutionPlan, graph.value, packet.value);
      if (!plan.ok || !plan.value) return validationFailure("substitution_plan", plan.errors);
      const architecture = validateCandidateArchitecture(
        candidateArchitecture,
        graph.value,
        plan.value,
        packet.value,
      );
      if (!architecture.ok || !architecture.value) {
        return validationFailure("candidate_architecture", architecture.errors);
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
      const architectureGate = runArchitectureGate(
        architecture.value,
        graph.value,
        plan.value,
        substitutionGate,
        expectedSubstitutionPlanDigest,
      );

      return text(
        JSON.stringify(
          {
            ok: true,
            architectureBlocked: !architectureGate.passed,
            admission,
            graphGate,
            substitutionGate,
            architectureGate,
            nextStage: architectureGate.passed
              ? "qualification_contract"
              : undefined,
          },
          null,
          2,
        ),
      );
    },
  );
}
