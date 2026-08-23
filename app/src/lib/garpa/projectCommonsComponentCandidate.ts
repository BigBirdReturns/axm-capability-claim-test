import type { ComponentObservation, ExecutionClass } from "../../types/garpaCommons";
import type {
  CommonsComponentProjectionReadiness,
  CommonsComponentProjectionRequest,
  CommonsProjectionFieldProvenance,
  ProjectedCommonsComponentCandidate,
} from "../../types/garpaCommonsProjection";
import type {
  ComponentCandidate,
  ComponentLifecycle,
  ComponentMaturity,
} from "../../types/garpaSubstitution";

const EXECUTION_RANK: Record<ExecutionClass, number> = {
  E0_analysis_only: 0,
  E1_simulation_or_replay: 1,
  E2_bench_passive: 2,
  E3_controlled_field_inert: 3,
  E4_regulated_active: 4,
  E5_operational_environment: 5,
};

export const COMMONS_PROJECTION_PROHIBITED_TRANSITIONS = [
  "A source-case price, availability statement, license, security note, performance envelope, or operating requirement cannot transfer into the target component candidate without target-case evidence.",
  "Compatibility admission cannot become target-case component performance qualification.",
  "A projected component candidate cannot satisfy the substitution, architecture, procurement, qualification, execution, mission-equivalence, vendor-parity, or publication gates by projection alone.",
  "Commons projection cannot assign locally_qualified maturity in the target case.",
] as const;

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim())));
}

function readiness(request: CommonsComponentProjectionRequest): CommonsComponentProjectionReadiness {
  const evidence = request.targetEvidence;
  const performanceClosed =
    evidence.performanceEvidenceCellIds.length > 0 &&
    Object.keys(evidence.performanceEnvelope).length > 0 &&
    request.compatibilityAdmissionReceipt.targetQualificationReceiptIds.length > 0;
  const licenseClosed =
    evidence.licenseEvidenceCellIds.length > 0 &&
    (Boolean(evidence.license?.trim()) || evidence.licenseNotApplicable === true);
  const operatingClosed =
    evidence.operatingRequirementEvidenceCellIds.length > 0 &&
    Object.keys(evidence.operatingRequirements).length > 0;
  const securityClosed =
    evidence.securityEvidenceCellIds.length > 0 && evidence.securityNotes.length > 0;
  const availabilityClosed = Boolean(evidence.availability?.evidenceCellIds.length);
  const economicClosed =
    !request.economicBoundaryRequired || Boolean(evidence.price?.evidenceCellIds.length);

  return performanceClosed &&
    licenseClosed &&
    operatingClosed &&
    securityClosed &&
    availabilityClosed &&
    economicClosed
    ? "substitution_ready"
    : "component_candidate";
}

function targetMaturity(
  request: CommonsComponentProjectionRequest,
  projectionReadiness: CommonsComponentProjectionReadiness,
): ComponentMaturity {
  if (projectionReadiness !== "substitution_ready") return "community_reported";
  return EXECUTION_RANK[request.compatibilityAdmissionReceipt.targetExecutionClass] >=
    EXECUTION_RANK.E3_controlled_field_inert
    ? "field_reproduced"
    : "bench_reproduced";
}

function targetLifecycle(request: CommonsComponentProjectionRequest): ComponentLifecycle {
  const state = request.targetEvidence.availability?.state;
  if (state === "in_stock") return "available";
  if (state === "limited" || state === "lead_time") return "limited";
  return "unverified";
}

function withheldFields(request: CommonsComponentProjectionRequest): string[] {
  const evidence = request.targetEvidence;
  const withheld: string[] = [];
  if (evidence.performanceEvidenceCellIds.length === 0 || Object.keys(evidence.performanceEnvelope).length === 0) {
    withheld.push("performanceEnvelope", "performanceEvidenceCellIds");
  }
  if (
    evidence.licenseEvidenceCellIds.length === 0 ||
    (!evidence.license?.trim() && evidence.licenseNotApplicable !== true)
  ) withheld.push("license", "licenseEvidenceCellIds");
  if (!evidence.price) withheld.push("price");
  if (!evidence.availability) withheld.push("availability");
  if (!evidence.sourceAvailability?.trim()) withheld.push("sourceAvailability");
  if (evidence.securityEvidenceCellIds.length === 0 || evidence.securityNotes.length === 0) {
    withheld.push("securityNotes");
  }
  if (
    evidence.operatingRequirementEvidenceCellIds.length === 0 ||
    Object.keys(evidence.operatingRequirements).length === 0
  ) withheld.push("operatingRequirements");
  return unique(withheld);
}

function evidencePulls(request: CommonsComponentProjectionRequest): string[] {
  const withheld = new Set(withheldFields(request));
  const pulls: string[] = [];
  if (withheld.has("performanceEnvelope")) {
    pulls.push("Measure or independently source the exact target-version performance envelope under the target fixture and bind it to target-case evidence cells.");
  }
  if (withheld.has("license")) {
    pulls.push("Recover the target-version license or an explicit target-case not-applicable determination with evidence custody.");
  }
  if (withheld.has("price")) {
    pulls.push("Capture a current target-case price with date, accounting boundary, and evidence coordinates before economic comparison.");
  }
  if (withheld.has("availability")) {
    pulls.push("Capture current target-case availability and lifecycle evidence for the exact component version.");
  }
  if (withheld.has("securityNotes")) {
    pulls.push("Complete a target-case security review and bind every material finding or no-finding statement to evidence.");
  }
  if (withheld.has("operatingRequirements")) {
    pulls.push("Define and source the target-case power, compute, network, environmental, and sustainment requirements.");
  }
  return pulls;
}

function provenance(
  request: CommonsComponentProjectionRequest,
  source: ComponentObservation,
  withheld: string[],
): CommonsProjectionFieldProvenance[] {
  const receipt = request.compatibilityAdmissionReceipt;
  const rows: CommonsProjectionFieldProvenance[] = [
    {
      field: "manufacturer/product/exactModelOrVersion",
      basis: "exact_commons_revision",
      sourceCoordinates: [receipt.catalogObjectId, receipt.revisionId, receipt.objectDigest],
      note: "Only exact identity values are read from the immutable source revision; target identity evidence remains mandatory.",
    },
    {
      field: "functionIds/interfaceIds",
      basis: "target_graph_mapping",
      sourceCoordinates: [receipt.targetCapabilityGraphDigest, ...receipt.targetCompatibilityReceiptIds],
      note: "Mappings come from target-case compatibility closure, not source-case identifiers.",
    },
    {
      field: "identityEvidenceCellIds",
      basis: "target_case_evidence",
      sourceCoordinates: [...request.targetEvidence.identityEvidenceCellIds, ...receipt.targetIdentityReceiptIds],
      note: "Target-case identity evidence authorizes use of the exact source identity as a candidate.",
    },
    {
      field: "maturity/lifecycle",
      basis: "derived_projection_policy",
      sourceCoordinates: [receipt.receiptDigest, ...receipt.targetQualificationReceiptIds],
      note: "Projection never assigns locally_qualified. Maturity and lifecycle are derived only from target evidence and target execution state.",
    },
    {
      field: "source limitations and residuals",
      basis: "exact_commons_revision",
      sourceCoordinates: [source.sourceReleaseId, source.sourceReleaseDigest],
      note: "Source limitations and residuals are carried forward because omission would overstate transferability.",
    },
  ];
  for (const field of withheld) {
    rows.push({
      field,
      basis: "withheld",
      sourceCoordinates: [],
      note: "The source-case value is deliberately not transferred; target-case evidence is required.",
    });
  }
  return rows;
}

export function projectCommonsComponentCandidate(
  request: CommonsComponentProjectionRequest,
  source: ComponentObservation,
): ProjectedCommonsComponentCandidate {
  const projectionReadiness = readiness(request);
  const withheld = withheldFields(request);
  const evidence = request.targetEvidence;
  const receipt = request.compatibilityAdmissionReceipt;

  const component: ComponentCandidate = {
    id: request.targetComponentId,
    kind: evidence.componentKind,
    manufacturer: source.componentIdentity.manufacturer,
    product: source.componentIdentity.product,
    exactModelOrVersion: source.componentIdentity.exactModelOrVersion,
    functionIds: unique(receipt.targetFunctionIds),
    interfaceIds: unique(receipt.targetInterfaceIds),
    maturity: targetMaturity(request, projectionReadiness),
    identityEvidenceCellIds: unique(evidence.identityEvidenceCellIds),
    performanceEvidenceCellIds: unique(evidence.performanceEvidenceCellIds),
    licenseEvidenceCellIds: unique(evidence.licenseEvidenceCellIds),
    performanceEnvelope: { ...evidence.performanceEnvelope },
    operatingRequirements: { ...evidence.operatingRequirements },
    license: evidence.license,
    sourceAvailability: evidence.sourceAvailability,
    securityNotes: [...evidence.securityNotes],
    price: evidence.price,
    availability: evidence.availability,
    integrationRequirements: unique(evidence.integrationRequirements),
    limitations: unique([
      ...source.limitations,
      ...evidence.limitations,
      "Source-case performance, qualification, price, availability, license, and operating assumptions do not transfer by projection.",
    ]),
    residuals: unique([
      ...source.residuals,
      ...evidence.residuals,
      "Target substitution readiness remains controlled by target-case evidence and the existing substitution gate.",
    ]),
    lifecycle: targetLifecycle(request),
  };

  return {
    projectionId: request.projectionId,
    targetCaseId: receipt.targetCaseId,
    sourceCatalogObjectId: receipt.catalogObjectId,
    sourceRevisionId: receipt.revisionId,
    sourceObjectDigest: receipt.objectDigest,
    closureReceiptDigest: receipt.receiptDigest,
    readiness: projectionReadiness,
    component,
    fieldProvenance: provenance(request, source, withheld),
    withheldFields: withheld,
    requiredEvidencePulls: evidencePulls(request),
    prohibitedTransitions: [...COMMONS_PROJECTION_PROHIBITED_TRANSITIONS],
  };
}
