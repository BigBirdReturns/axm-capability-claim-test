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
import { validateQualificationContract } from "../app/src/lib/garpa/validateQualificationContract.ts";
import { runQualificationGate } from "../app/src/lib/garpa/runQualificationGate.ts";

const JSON_INPUT = z.union([z.string(), z.record(z.any())]);

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

function validationFailure(stage: string, errors: string[]) {
  return text(JSON.stringify({ ok: false, stage, errors }, null, 2));
}

export function registerGarpaQualificationTools(server: McpServer): void {
  server.registerTool(
    "validate_garpa_qualification_contract",
    {
      title: "Validate a GARPA qualification contract",
      description:
        "Validates the full GARPA chain through a frozen qualification contract, including scenarios, mission-linked metrics, instrumentation, comparators, accounting boundaries, authorizations, and acceptance rules.",
      inputSchema: {
        claimPacket: JSON_INPUT,
        missionOutcome: JSON_INPUT,
        capabilityGraph: JSON_INPUT,
        substitutionPlan: JSON_INPUT,
        candidateArchitecture: JSON_INPUT,
        qualificationContract: JSON_INPUT,
      },
    },
    async ({
      claimPacket,
      missionOutcome,
      capabilityGraph,
      substitutionPlan,
      candidateArchitecture,
      qualificationContract,
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
      const contract = validateQualificationContract(
        qualificationContract,
        outcome.value,
        architecture.value,
        packet.value,
      );
      return text(
        JSON.stringify(
          {
            ok: contract.ok,
            stage: "qualification_contract",
            errors: contract.errors,
          },
          null,
          2,
        ),
      );
    },
  );

  server.registerTool(
    "run_garpa_qualification_gate",
    {
      title: "Run the GARPA qualification gate",
      description:
        "Runs every GARPA gate through a frozen qualification contract. It preserves mission thresholds and baselines, requires complete scenario and instrumentation coverage, binds architecture risks and residuals to tests, aligns comparators and accounting, enforces authority, and uses non-compensatory essential metrics. Passing permits build-manifest work only.",
      inputSchema: {
        claimPacket: JSON_INPUT,
        missionOutcome: JSON_INPUT,
        capabilityGraph: JSON_INPUT,
        expectedMissionOutcomeDigest: z.string().min(1),
        substitutionPlan: JSON_INPUT,
        expectedCapabilityGraphDigest: z.string().min(1),
        candidateArchitecture: JSON_INPUT,
        expectedSubstitutionPlanDigest: z.string().min(1),
        qualificationContract: JSON_INPUT,
        expectedCandidateArchitectureDigest: z.string().min(1),
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
      qualificationContract,
      expectedCandidateArchitectureDigest,
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
      const contract = validateQualificationContract(
        qualificationContract,
        outcome.value,
        architecture.value,
        packet.value,
      );
      if (!contract.ok || !contract.value) {
        return validationFailure("qualification_contract", contract.errors);
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
      const qualificationGate = runQualificationGate(
        contract.value,
        outcome.value,
        architecture.value,
        architectureGate,
        expectedCandidateArchitectureDigest,
      );

      return text(
        JSON.stringify(
          {
            ok: true,
            qualificationBlocked: !qualificationGate.passed,
            admission,
            graphGate,
            substitutionGate,
            architectureGate,
            qualificationGate,
            nextStage: qualificationGate.passed ? "build_manifest" : undefined,
          },
          null,
          2,
        ),
      );
    },
  );
}
