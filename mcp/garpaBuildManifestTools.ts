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
import { validateBuildManifest } from "../app/src/lib/garpa/validateBuildManifest.ts";
import { runBuildManifestGate } from "../app/src/lib/garpa/runBuildManifestGate.ts";

const JSON_INPUT = z.union([z.string(), z.record(z.any())]);

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

function validationFailure(stage: string, errors: string[]) {
  return text(JSON.stringify({ ok: false, stage, errors }, null, 2));
}

export function registerGarpaBuildManifestTools(server: McpServer): void {
  server.registerTool(
    "validate_garpa_build_manifest",
    {
      title: "Validate a GARPA build manifest",
      description:
        "Validates the complete GARPA chain through a frozen build manifest, including exact component and software versions, compatibility edges, roles, dependencies, instrumentation, calibration, substitution policy, assembly steps, and architecture cost and schedule traces.",
      inputSchema: {
        claimPacket: JSON_INPUT,
        missionOutcome: JSON_INPUT,
        capabilityGraph: JSON_INPUT,
        substitutionPlan: JSON_INPUT,
        candidateArchitecture: JSON_INPUT,
        qualificationContract: JSON_INPUT,
        buildManifest: JSON_INPUT,
      },
    },
    async ({
      claimPacket,
      missionOutcome,
      capabilityGraph,
      substitutionPlan,
      candidateArchitecture,
      qualificationContract,
      buildManifest,
    }) => {
      const packet = validateClaimPacket(claimPacket);
      if (!packet.ok || !packet.value) {
        return validationFailure("claim_packet", packet.errors);
      }
      const outcome = validateMissionOutcome(missionOutcome, packet.value);
      if (!outcome.ok || !outcome.value) {
        return validationFailure("mission_outcome", outcome.errors);
      }
      const graph = validateCapabilityGraph(
        capabilityGraph,
        packet.value,
        outcome.value,
      );
      if (!graph.ok || !graph.value) {
        return validationFailure("capability_graph", graph.errors);
      }
      const plan = validateSubstitutionPlan(
        substitutionPlan,
        graph.value,
        packet.value,
      );
      if (!plan.ok || !plan.value) {
        return validationFailure("substitution_plan", plan.errors);
      }
      const architecture = validateCandidateArchitecture(
        candidateArchitecture,
        graph.value,
        plan.value,
        packet.value,
      );
      if (!architecture.ok || !architecture.value) {
        return validationFailure("candidate_architecture", architecture.errors);
      }
      const qualification = validateQualificationContract(
        qualificationContract,
        outcome.value,
        architecture.value,
        packet.value,
      );
      if (!qualification.ok || !qualification.value) {
        return validationFailure("qualification_contract", qualification.errors);
      }
      const manifest = validateBuildManifest(
        buildManifest,
        architecture.value,
        plan.value,
        qualification.value,
      );
      return text(
        JSON.stringify(
          {
            ok: manifest.ok,
            stage: "build_manifest",
            errors: manifest.errors,
          },
          null,
          2,
        ),
      );
    },
  );

  server.registerTool(
    "run_garpa_build_manifest_gate",
    {
      title: "Run the GARPA build-manifest gate",
      description:
        "Runs every GARPA gate through a frozen executable build manifest. It requires exact version and quantity custody, complete interface and role transfer, qualification instrumentation and calibration, governed substitutions, acyclic assembly steps, and complete architecture cost and schedule trace. Passing permits controlled assembly only; it does not claim an as-built or measured result.",
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
        buildManifest: JSON_INPUT,
        expectedQualificationContractDigest: z.string().min(1),
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
      buildManifest,
      expectedQualificationContractDigest,
    }) => {
      const packet = validateClaimPacket(claimPacket);
      if (!packet.ok || !packet.value) {
        return validationFailure("claim_packet", packet.errors);
      }
      const outcome = validateMissionOutcome(missionOutcome, packet.value);
      if (!outcome.ok || !outcome.value) {
        return validationFailure("mission_outcome", outcome.errors);
      }
      const graph = validateCapabilityGraph(
        capabilityGraph,
        packet.value,
        outcome.value,
      );
      if (!graph.ok || !graph.value) {
        return validationFailure("capability_graph", graph.errors);
      }
      const plan = validateSubstitutionPlan(
        substitutionPlan,
        graph.value,
        packet.value,
      );
      if (!plan.ok || !plan.value) {
        return validationFailure("substitution_plan", plan.errors);
      }
      const architecture = validateCandidateArchitecture(
        candidateArchitecture,
        graph.value,
        plan.value,
        packet.value,
      );
      if (!architecture.ok || !architecture.value) {
        return validationFailure("candidate_architecture", architecture.errors);
      }
      const qualification = validateQualificationContract(
        qualificationContract,
        outcome.value,
        architecture.value,
        packet.value,
      );
      if (!qualification.ok || !qualification.value) {
        return validationFailure("qualification_contract", qualification.errors);
      }
      const manifest = validateBuildManifest(
        buildManifest,
        architecture.value,
        plan.value,
        qualification.value,
      );
      if (!manifest.ok || !manifest.value) {
        return validationFailure("build_manifest", manifest.errors);
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
        qualification.value,
        outcome.value,
        architecture.value,
        architectureGate,
        expectedCandidateArchitectureDigest,
      );
      const buildManifestGate = runBuildManifestGate(
        manifest.value,
        architecture.value,
        plan.value,
        qualification.value,
        qualificationGate,
        expectedQualificationContractDigest,
      );

      return text(
        JSON.stringify(
          {
            ok: true,
            buildManifestBlocked: !buildManifestGate.passed,
            admission,
            graphGate,
            substitutionGate,
            architectureGate,
            qualificationGate,
            buildManifestGate,
            nextStage: buildManifestGate.passed
              ? "controlled_assembly"
              : undefined,
          },
          null,
          2,
        ),
      );
    },
  );
}
