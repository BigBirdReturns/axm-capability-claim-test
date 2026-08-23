import type {
  ClaimPacket,
  EvidenceCell,
  EvidenceControl,
  EvidenceTarget,
} from "../../types/garpa";
import type { ComponentObservation, ExecutionClass } from "../../types/garpaCommons";
import type {
  CommonsComponentProjectionFinding,
  CommonsComponentProjectionIntent,
  CommonsComponentProjectionRequest,
  CommonsComponentProjectionResult,
  CommonsProjectedComponent,
  CommonsSubstitutionSeed,
} from "../../types/garpaCommonsProjection";
import type { CommonsTransferredNomination } from "../../types/garpaCommonsTransfer";
import type { ComponentCandidate } from "../../types/garpaSubstitution";
import { computeCommonsTransferResultDigest } from "./commonsComponentProjectionDigest";
import { runCommonsTransferGate } from "./runCommonsTransferGate";
import { validateCommonsComponentProjectionRequest } from "./validateCommonsComponentProjection";

const EXTERNAL_CONTROLS = new Set<EvidenceControl>([
  "externally_attributed",
  "independent",
  "local_measured",
]);
const SOFTWARE_KINDS = new Set([
  "software_package",
  "open_source_project",
  "service",
  "custom_code",
]);
const EXECUTION_RANK: Record<ExecutionClass, number> = {
  E0_analysis_only: 0,
  E1_simulation_or_replay: 1,
  E2_bench_passive: 2,
  E3_controlled_field_inert: 3,
  E4_regulated_active: 4,
  E5_operational_environment: 5,
};

export const COMMONS_PROJECTION_PROHIBITED_TRANSITIONS = [
  "A projected component cannot inherit source-case performance, price, availability, license, or qualification as target-case evidence.",
  "A projected component cannot establish target-case compatibility, complete function coverage, complete interface coverage, or an admitted substitution option.",
  "A projection seed cannot satisfy the substitution, architecture, qualification, procurement, test, deployment, mission-equivalence, vendor-parity, or publication gates.",
] as const;

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function exactSet(left: string[], right: string[]): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function includesAll(actual: string[], required: string[]): boolean {
  const values = new Set(actual.map(normalize));
  return required.every((item) => values.has(normalize(item)));
}

function cellsFor(ids: string[], packet: ClaimPacket): EvidenceCell[] {
  const cells = new Map(packet.evidence.map((cell) => [cell.id, cell]));
  return ids.flatMap((id) => {
    const cell = cells.get(id);
    return cell ? [cell] : [];
  });
}

function hasEvidence(
  ids: string[],
  packet: ClaimPacket,
  target: EvidenceTarget,
  exactVersion: string,
  controls?: ReadonlySet<EvidenceControl>,
): boolean {
  return cellsFor(ids, packet).some(
    (cell) =>
      cell.target === target &&
      cell.subjectVersion?.trim() === exactVersion.trim() &&
      (!controls || controls.has(cell.control)),
  );
}

function hasLocalPerformance(
  candidate: ComponentCandidate,
  packet: ClaimPacket,
): boolean {
  return cellsFor(candidate.performanceEvidenceCellIds, packet).some(
    (cell) =>
      cell.target === "component_performance" &&
      cell.subjectVersion?.trim() === candidate.exactModelOrVersion.trim() &&
      cell.control === "local_measured" &&
      cell.venue === "local_reproduction" &&
      Boolean(cell.fixture?.trim()) &&
      Boolean(cell.method?.trim()) &&
      Boolean(cell.environment?.trim()),
  );
}

function performanceEarned(
  candidate: ComponentCandidate,
  packet: ClaimPacket,
  targetExecutionClass: ExecutionClass | undefined,
): boolean {
  if (candidate.maturity === "independently_reported") {
    return hasEvidence(
      candidate.performanceEvidenceCellIds,
      packet,
      "component_performance",
      candidate.exactModelOrVersion,
      EXTERNAL_CONTROLS,
    );
  }
  if (candidate.maturity === "bench_reproduced") {
    return (
      Boolean(targetExecutionClass) &&
      EXECUTION_RANK[targetExecutionClass!] >= EXECUTION_RANK.E2_bench_passive &&
      hasLocalPerformance(candidate, packet)
    );
  }
  if (candidate.maturity === "field_reproduced") {
    return (
      Boolean(targetExecutionClass) &&
      EXECUTION_RANK[targetExecutionClass!] >=
        EXECUTION_RANK.E3_controlled_field_inert &&
      hasLocalPerformance(candidate, packet)
    );
  }
  return false;
}

function identityMatches(
  candidate: ComponentCandidate,
  source: ComponentObservation,
): boolean {
  return (
    normalize(candidate.manufacturer) ===
      normalize(source.componentIdentity.manufacturer) &&
    normalize(candidate.product) === normalize(source.componentIdentity.product) &&
    normalize(candidate.exactModelOrVersion) ===
      normalize(source.componentIdentity.exactModelOrVersion)
  );
}

function sourceBoundaryCarried(
  intent: CommonsComponentProjectionIntent,
  nomination: CommonsTransferredNomination,
  source: ComponentObservation,
): boolean {
  const candidate = intent.candidate;
  const firmware = source.componentIdentity.firmwareOrSoftwareVersion;
  const firmwareCarried = !firmware ||
    normalize(candidate.operatingRequirements.firmwareOrSoftwareVersion) ===
      normalize(firmware);
  return (
    firmwareCarried &&
    includesAll(candidate.residuals, [
      ...source.residuals,
      ...nomination.knownMismatches,
    ]) &&
    includesAll(candidate.limitations, source.limitations) &&
    includesAll(
      candidate.integrationRequirements,
      nomination.requiredQualificationTests,
    )
  );
}

function addFinding(
  findings: CommonsComponentProjectionFinding[],
  state: CommonsComponentProjectionFinding["state"],
  intent: CommonsComponentProjectionIntent | undefined,
  reason: string,
  requiredAction: string,
): void {
  findings.push({
    state,
    projectionId: intent?.projectionId,
    nominationId: intent?.nominationId,
    candidateId: intent?.candidate.id,
    reason,
    requiredAction,
  });
}

function candidateFindings(
  request: CommonsComponentProjectionRequest,
  intent: CommonsComponentProjectionIntent,
  nomination: CommonsTransferredNomination | undefined,
): CommonsComponentProjectionFinding[] {
  const findings: CommonsComponentProjectionFinding[] = [];
  if (!nomination) {
    addFinding(
      findings,
      "transfer_candidate_missing",
      intent,
      "The projection does not resolve to an admitted transfer nomination.",
      "Select an exact nomination returned by the recomputed Commons transfer gate.",
    );
    return findings;
  }
  if (nomination.disposition !== "candidate_input") {
    addFinding(
      findings,
      "nomination_not_candidate_input",
      intent,
      "The nomination is a research lead rather than a candidate input.",
      "Keep the object in research context or obtain a current exact-version component observation that passes transfer.",
    );
    return findings;
  }
  if (nomination.source.objectType !== "component_observation") {
    addFinding(
      findings,
      "source_not_component_observation",
      intent,
      "Only a component observation can be projected into ComponentCandidate.",
      "Use primitives and architecture patterns as research context rather than component evidence.",
    );
    return findings;
  }

  const source = nomination.source.value as ComponentObservation;
  const candidate = intent.candidate;
  if (!identityMatches(candidate, source)) {
    addFinding(
      findings,
      "candidate_identity_mismatch",
      intent,
      "The target candidate changes the source manufacturer, product, or exact model/version.",
      "Project the exact source identity or open a separate target retrieval path for the different component.",
    );
  }
  if (
    !exactSet(candidate.functionIds, nomination.targetFunctionIds) ||
    !exactSet(candidate.interfaceIds, nomination.targetInterfaceIds)
  ) {
    addFinding(
      findings,
      "target_mapping_mismatch",
      intent,
      "The candidate function or interface mapping differs from the admitted nomination.",
      "Use the exact admitted target mappings or rerun Commons transfer with a revised mapping.",
    );
  }
  if (
    !hasEvidence(
      candidate.identityEvidenceCellIds,
      request.targetClaimPacket,
      "component_identity",
      candidate.exactModelOrVersion,
    )
  ) {
    addFinding(
      findings,
      "target_identity_evidence_missing",
      intent,
      "The target case lacks exact-version component identity evidence.",
      "Add target-case component_identity evidence bound to the exact model or version.",
    );
  }
  if (
    !performanceEarned(
      candidate,
      request.targetClaimPacket,
      request.transferRequest.targetExecutionClass,
    )
  ) {
    addFinding(
      findings,
      "target_performance_unearned",
      intent,
      "The requested target maturity is not earned by target-case performance evidence.",
      "Add external or local target-case component_performance evidence, or reduce the maturity claim.",
    );
  }
  if (
    !candidate.availability ||
    ["unavailable", "unknown"].includes(candidate.availability.state) ||
    !hasEvidence(
      candidate.availability.evidenceCellIds,
      request.targetClaimPacket,
      "component_availability",
      candidate.exactModelOrVersion,
      EXTERNAL_CONTROLS,
    )
  ) {
    addFinding(
      findings,
      "target_availability_unresolved",
      intent,
      "Current target-case availability is absent or unresolved.",
      "Add a dated external availability observation for the exact target version.",
    );
  }
  if (
    !candidate.price ||
    !hasEvidence(
      candidate.price.evidenceCellIds,
      request.targetClaimPacket,
      "component_price",
      candidate.exactModelOrVersion,
      EXTERNAL_CONTROLS,
    )
  ) {
    addFinding(
      findings,
      "target_price_unresolved",
      intent,
      "The candidate lacks a target-case price observation for the exact version.",
      "Add a dated external price observation with an explicit cost boundary.",
    );
  }
  if (
    SOFTWARE_KINDS.has(candidate.kind) &&
    (!candidate.license?.trim() ||
      !hasEvidence(
        candidate.licenseEvidenceCellIds,
        request.targetClaimPacket,
        "component_license",
        candidate.exactModelOrVersion,
      ))
  ) {
    addFinding(
      findings,
      "target_license_unresolved",
      intent,
      "Software or service licensing is not resolved in the target case.",
      "Add exact-version component_license evidence and the governing license.",
    );
  }
  if (!sourceBoundaryCarried(intent, nomination, source)) {
    addFinding(
      findings,
      "source_boundary_not_carried",
      intent,
      "The target candidate omits a source residual, limitation, mismatch, firmware constraint, or required requalification test.",
      "Carry every source boundary verbatim into the target candidate and projection receipt.",
    );
  }
  if (!["available", "limited"].includes(candidate.lifecycle)) {
    addFinding(
      findings,
      "target_lifecycle_invalid",
      intent,
      `Lifecycle ${candidate.lifecycle} cannot enter the active target candidate set.`,
      "Resolve the component as available or limited, or retain it as a research lead.",
    );
  }
  return findings;
}

function projected(
  intent: CommonsComponentProjectionIntent,
  nomination: CommonsTransferredNomination,
): CommonsProjectedComponent {
  return {
    projectionId: intent.projectionId,
    nominationId: intent.nominationId,
    transferDisposition: nomination.disposition,
    source: {
      catalogObjectId: nomination.source.catalogObjectId,
      revisionId: nomination.source.revisionId,
      objectDigest: nomination.source.objectDigest,
      sourceCaseId: nomination.source.sourceCaseId,
      sourceReleaseId: nomination.source.sourceReleaseId,
      sourceReleaseDigest: nomination.source.sourceReleaseDigest,
      observation: nomination.source.value as ComponentObservation,
    },
    candidate: intent.candidate,
    requiredEvidencePulls: nomination.requiredEvidencePulls,
    requiredQualificationTests: nomination.requiredQualificationTests,
    knownMismatches: nomination.knownMismatches,
  };
}

function buildSeed(
  request: CommonsComponentProjectionRequest,
  transferResultDigest: string,
  components: CommonsProjectedComponent[],
): CommonsSubstitutionSeed {
  const graph = request.transferRequest.targetCapabilityGraph;
  const mappedFunctionIds = Array.from(
    new Set(components.flatMap((item) => item.candidate.functionIds)),
  ).sort();
  const mappedInterfaceIds = Array.from(
    new Set(components.flatMap((item) => item.candidate.interfaceIds)),
  ).sort();
  const requiredFunctionIds = graph.functions
    .filter((fn) => fn.state === "required" && fn.functionClass !== "vendor_specific")
    .map((fn) => fn.id);
  const requiredInterfaceIds = graph.interfaces
    .filter(
      (edge) =>
        edge.producerFunctionIds.some((id) => requiredFunctionIds.includes(id)) ||
        edge.consumerFunctionIds.some((id) => requiredFunctionIds.includes(id)),
    )
    .map((edge) => edge.id);
  return {
    schemaVersion: 1,
    caseId: graph.caseId,
    capabilityGraphDigest: request.transferRequest.targetCapabilityGraphDigest,
    transferResultDigest,
    componentCandidateIds: components.map((item) => item.candidate.id),
    components: components.map((item) => item.candidate),
    mappedFunctionIds,
    mappedInterfaceIds,
    unmappedRequiredFunctionIds: requiredFunctionIds.filter(
      (id) => !mappedFunctionIds.includes(id),
    ),
    unmappedRequiredInterfaceIds: requiredInterfaceIds.filter(
      (id) => !mappedInterfaceIds.includes(id),
    ),
    requiredCompatibilityInterfaceIds: mappedInterfaceIds,
    requiredQualificationTests: Array.from(
      new Set(components.flatMap((item) => item.requiredQualificationTests)),
    ),
    prohibitedTransitions: [...COMMONS_PROJECTION_PROHIBITED_TRANSITIONS],
  };
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function runCommonsComponentProjectionGate(
  input: CommonsComponentProjectionRequest | unknown,
): CommonsComponentProjectionResult {
  const validated = validateCommonsComponentProjectionRequest(input);
  if (!validated.ok || !validated.value) {
    return {
      passed: false,
      state: "projection_blocked",
      transferResult: {
        passed: false,
        state: "transfer_blocked",
        admittedNominationIds: [],
        candidateInputNominationIds: [],
        researchLeadNominationIds: [],
        blockedNominationIds: [],
        findings: [],
        nominations: [],
        pullList: validated.errors,
        prohibitedTransitions: [],
      },
      transferResultDigest: "",
      admittedProjectionIds: [],
      blockedProjectionIds: [],
      projectedComponents: [],
      findings: validated.errors.map((reason) => ({
        state: "transfer_result_mismatch" as const,
        reason,
        requiredAction: "Repair the projection request and rerun validation.",
      })),
      pullList: validated.errors,
      prohibitedTransitions: [...COMMONS_PROJECTION_PROHIBITED_TRANSITIONS],
    };
  }

  const request = validated.value;
  const transferResult = runCommonsTransferGate(request.transferRequest);
  const transferResultDigest = computeCommonsTransferResultDigest(transferResult);
  const findings: CommonsComponentProjectionFinding[] = [];
  if (transferResultDigest !== request.expectedTransferResultDigest) {
    addFinding(
      findings,
      "transfer_result_mismatch",
      undefined,
      "The expected transfer-result digest does not match the recomputed transfer result.",
      "Refresh the transfer result and bind the projection request to its canonical digest.",
    );
  }

  const duplicateCandidateIds = request.projections
    .map((item) => item.candidate.id)
    .filter((id, index, values) => values.indexOf(id) !== index);
  for (const intent of request.projections) {
    if (duplicateCandidateIds.includes(intent.candidate.id)) {
      addFinding(
        findings,
        "duplicate_projection",
        intent,
        `Candidate id ${intent.candidate.id} is projected more than once.`,
        "Assign one unique target component id to each projected nomination.",
      );
      continue;
    }
    const nomination = transferResult.nominations.find(
      (item) => item.nominationId === intent.nominationId,
    );
    findings.push(...candidateFindings(request, intent, nomination));
  }

  const blockedProjectionIds = dedupe(
    findings.flatMap((finding) =>
      finding.projectionId ? [finding.projectionId] : [],
    ),
  );
  const globalBlocked = findings.some((finding) => !finding.projectionId);
  const projectedComponents = request.projections.flatMap((intent) => {
    if (globalBlocked || blockedProjectionIds.includes(intent.projectionId)) return [];
    const nomination = transferResult.nominations.find(
      (item) => item.nominationId === intent.nominationId,
    );
    return nomination ? [projected(intent, nomination)] : [];
  });
  const admittedProjectionIds = projectedComponents.map((item) => item.projectionId);
  const state = projectedComponents.length === 0
    ? "projection_blocked"
    : blockedProjectionIds.length > 0 || globalBlocked
      ? "projection_partially_admitted"
      : "projection_admitted";
  const pullList = dedupe(findings.map((finding) => finding.requiredAction));

  return {
    passed: state === "projection_admitted",
    state,
    transferResult,
    transferResultDigest,
    admittedProjectionIds,
    blockedProjectionIds,
    projectedComponents,
    findings,
    pullList,
    seed: projectedComponents.length > 0
      ? buildSeed(request, transferResultDigest, projectedComponents)
      : undefined,
    prohibitedTransitions: [...COMMONS_PROJECTION_PROHIBITED_TRANSITIONS],
  };
}
