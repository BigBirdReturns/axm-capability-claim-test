import type { BuildManifest } from "../../types/garpaBuild";
import type {
  CommonsSeededAsBuiltReceipt,
} from "../../types/garpaCommonsSeededBuildReceipt";
import type {
  CommonsSeededPreflightFinding,
  CommonsSeededPreflightReceipt,
  CommonsSeededPreflightRequest,
  CommonsSeededPreflightResult,
} from "../../types/garpaCommonsSeededPreflight";
import type {
  BuildReceipt,
  PreflightReadiness,
} from "../../types/garpaExecution";
import { canonicalStringify } from "./canonicalJson";
import { computeCommonsSeededPreflightReceiptDigest } from "./commonsSeededPreflightDigest";
import { runCommonsSeededBuildReceiptGate } from "./runCommonsSeededBuildReceiptGate";
import { runPreflightGate } from "./runPreflightGate";
import { sha256Hex } from "./sha256";
import { validateCommonsSeededPreflightRequest } from "./validateCommonsSeededPreflight";

export const COMMONS_SEEDED_PREFLIGHT_PROHIBITED_TRANSITIONS = [
  "A ready preflight receipt does not constitute a test result, qualification result, deployment result, or mission-equivalence claim.",
  "A run reservation is valid only for the exact as-built receipt, qualification scenario, instrumentation, authority, and preflight digest.",
  "Any changed installed identity, firmware, configuration, fixture, instrumentation, authorization, operator, storage path, clock policy, abort path, run reservation, or hazard boundary invalidates preflight.",
] as const;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function exactSet(left: string[], right: string[]): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function addFinding(
  findings: CommonsSeededPreflightFinding[],
  state: CommonsSeededPreflightFinding["state"],
  reason: string,
  requiredAction: string,
  coordinates: Partial<CommonsSeededPreflightFinding> = {},
): void {
  findings.push({ state, reason, requiredAction, ...coordinates });
}

function findObject(
  root: unknown,
  predicate: (value: RecordValue) => boolean,
  seen = new Set<unknown>(),
): RecordValue | undefined {
  if (seen.has(root)) return undefined;
  seen.add(root);
  if (isRecord(root)) {
    if (predicate(root)) return root;
    for (const value of Object.values(root)) {
      const found = findObject(value, predicate, seen);
      if (found) return found;
    }
  } else if (Array.isArray(root)) {
    for (const value of root) {
      const found = findObject(value, predicate, seen);
      if (found) return found;
    }
  }
  return undefined;
}

function findQualificationContract(
  request: CommonsSeededPreflightRequest,
): RecordValue {
  return findObject(
    request.seededBuildReceiptRequest,
    (value) =>
      Array.isArray(value.scenarios) &&
      Array.isArray(value.metrics) &&
      Array.isArray(value.instrumentation) &&
      Array.isArray(value.authorizations) &&
      isRecord(value.acceptanceRule),
  ) ?? {};
}

function findArchitecture(request: CommonsSeededPreflightRequest): RecordValue {
  return findObject(
    request.seededBuildReceiptRequest,
    (value) =>
      Array.isArray(value.componentSelections) &&
      Array.isArray(value.humanRoleSelections) &&
      Array.isArray(value.risks) &&
      Array.isArray(value.residuals),
  ) ?? {};
}

function findBuildManifest(
  request: CommonsSeededPreflightRequest,
): BuildManifest | undefined {
  const found = findObject(
    request.seededBuildReceiptRequest,
    (value) =>
      value.schemaVersion === 1 &&
      typeof value.manifestDigest === "string" &&
      Array.isArray(value.components) &&
      Array.isArray(value.instrumentation) &&
      Array.isArray(value.assemblySteps) &&
      Array.isArray(value.substitutionPolicies),
  );
  return found as unknown as BuildManifest | undefined;
}

function recordArray(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function referencedEvidenceIds(receipt: CommonsSeededPreflightReceipt): string[] {
  return [
    ...receipt.fixtureChecks.flatMap((item) => item.evidenceIds),
    ...receipt.instrumentationChecks.flatMap((item) => [
      ...item.calibrationEvidenceIds,
      ...item.evidenceIds,
    ]),
    ...receipt.operatorChecks.flatMap((item) => item.trainingEvidenceIds),
    ...receipt.authorizationChecks.flatMap((item) => item.evidenceIds),
    ...receipt.hazardControls.flatMap((item) => item.evidenceIds),
    ...receipt.clockCheck.evidenceIds,
    ...receipt.storageCheck.evidenceIds,
    ...receipt.abortCheck.evidenceIds,
    ...receipt.runReservations.flatMap((item) => item.uniquenessEvidenceIds),
  ];
}

function timeInside(value: string, start: string, end: string): boolean {
  const time = Date.parse(value);
  return time >= Date.parse(start) && time <= Date.parse(end);
}

function toOrdinaryBuildReceipt(
  asBuilt: CommonsSeededAsBuiltReceipt,
): BuildReceipt {
  return {
    schemaVersion: 1,
    caseId: asBuilt.caseId,
    buildId: asBuilt.receiptId,
    manifestDigest: asBuilt.buildManifestDigest,
    architectureDigest: asBuilt.candidateArchitectureDigest,
    qualificationContractDigest: asBuilt.qualificationContractDigest,
    startedAt: asBuilt.startedAt,
    completedAt: asBuilt.completedAt,
    installedHardware: [],
    installedSoftware: [],
    codeCommits: [],
    substitutions: [],
    deviations: asBuilt.deviations.map((deviation) => ({
      id: deviation.deviationId,
      description: deviation.description,
      severity: deviation.disposition === "blocked" ? "unsafe" : "material",
      affectedFunctionIds: [],
      affectedMetricIds: [],
      closureState:
        deviation.disposition === "blocked"
          ? "open"
          : deviation.disposition === "reworked"
            ? "closed"
            : "accepted",
      evidenceArtifactIds: [...deviation.evidenceArtifactIds],
    })),
    actualCostLines: [],
    actualLabor: [],
    artifacts: [],
    buildDigest: asBuilt.receiptDigest,
    state:
      asBuilt.state === "assembled"
        ? "assembled"
        : asBuilt.state === "superseded"
          ? "superseded"
          : "blocked",
  };
}

function hasAnyFinding(
  findings: CommonsSeededPreflightFinding[],
  states: CommonsSeededPreflightFinding["state"][],
): boolean {
  const set = new Set(states);
  return findings.some((finding) => set.has(finding.state));
}

function readinessFromFindings(
  findings: CommonsSeededPreflightFinding[],
): PreflightReadiness {
  return {
    fixtureReady: !hasAnyFinding(findings, [
      "fixture_check_missing",
      "fixture_not_ready",
      "fixture_configuration_mismatch",
      "evidence_time_order_invalid",
    ]),
    instrumentationReady: !hasAnyFinding(findings, [
      "instrumentation_check_missing",
      "instrumentation_identity_mismatch",
      "instrumentation_configuration_mismatch",
      "instrumentation_clock_source_mismatch",
      "instrumentation_storage_unverified",
    ]),
    calibrationReady: !hasAnyFinding(findings, [
      "instrumentation_calibration_invalid",
    ]),
    storageReady: !hasAnyFinding(findings, [
      "storage_check_incomplete",
      "instrumentation_storage_unverified",
    ]),
    clocksReady: !hasAnyFinding(findings, ["clock_check_incomplete"]),
    authorityReady: !hasAnyFinding(findings, [
      "authorization_check_missing",
      "authorization_not_satisfied",
      "authorization_scope_mismatch",
    ]),
    hazardControlsReady: !hasAnyFinding(findings, [
      "hazard_control_missing",
      "hazard_control_open",
    ]),
    abortPathReady: !hasAnyFinding(findings, ["abort_check_incomplete"]),
    operatorRolesReady: !hasAnyFinding(findings, [
      "operator_check_missing",
      "operator_not_ready",
      "operator_scope_mismatch",
    ]),
    runIdReserved: !hasAnyFinding(findings, [
      "run_reservation_missing",
      "run_reservation_duplicate",
      "run_reservation_scenario_invalid",
    ]),
  };
}

export function runCommonsSeededPreflightGate(
  input: CommonsSeededPreflightRequest | unknown,
): CommonsSeededPreflightResult {
  const validated = validateCommonsSeededPreflightRequest(input);
  if (!validated.ok || !validated.value) {
    return {
      passed: false,
      state: "seeded_preflight_blocked",
      seededBuildReceiptResultDigest: "",
      preflightReceiptDigest: "",
      asBuiltReceiptDigest: "",
      readyFixtureIds: [],
      readyInstrumentationIds: [],
      readyHumanRoleIds: [],
      satisfiedAuthorizationIds: [],
      reservedRunIds: [],
      findings: validated.errors.map((reason) => ({
        state: "preflight_validation_failed" as const,
        reason,
        requiredAction:
          "Repair the seeded preflight request and rerun validation.",
      })),
      validationErrors: validated.errors,
      pullList: validated.errors,
      prohibitedTransitions: [
        ...COMMONS_SEEDED_PREFLIGHT_PROHIBITED_TRANSITIONS,
      ],
    };
  }

  const request = validated.value;
  const priorResult = runCommonsSeededBuildReceiptGate(
    request.seededBuildReceiptRequest,
  );
  const priorDigest = sha256Hex(canonicalStringify(priorResult));
  const receipt = request.preflightReceipt;
  const receiptDigest = computeCommonsSeededPreflightReceiptDigest(receipt);
  const asBuilt = request.seededBuildReceiptRequest.asBuiltReceipt;
  const qualification = findQualificationContract(request);
  const architecture = findArchitecture(request);
  const buildManifest = findBuildManifest(request);
  const scenarios = recordArray(qualification.scenarios);
  const instruments = recordArray(qualification.instrumentation);
  const authorizations = recordArray(qualification.authorizations);
  const roles = recordArray(architecture.humanRoleSelections);
  const manifestInstruments = new Map(
    (buildManifest?.instrumentation ?? []).map((item) => [
      item.instrumentationId,
      item,
    ]),
  );
  const findings: CommonsSeededPreflightFinding[] = [];

  if (
    priorDigest !== request.expectedSeededBuildReceiptResultDigest ||
    receipt.seededBuildReceiptResultDigest !== priorDigest
  ) {
    addFinding(
      findings,
      "seeded_build_receipt_result_mismatch",
      "The expected or receipted as-built result digest does not match deterministic recomputation.",
      "Refresh the admitted as-built result and bind preflight to its canonical digest.",
    );
  }
  if (!priorResult.passed) {
    addFinding(
      findings,
      "seeded_build_receipt_not_admitted",
      "The governing Commons-seeded as-built receipt is not admitted for preflight.",
      "Resolve every installed-state and receipt-custody finding before preflight.",
    );
  }
  if (receipt.receiptDigest !== receiptDigest) {
    addFinding(
      findings,
      "preflight_receipt_digest_mismatch",
      "The preflight receipt digest does not match its canonical content.",
      "Restore the immutable readiness record and recompute its digest.",
    );
  }
  if (receipt.caseId !== asBuilt.caseId) {
    addFinding(
      findings,
      "preflight_case_mismatch",
      "The preflight receipt belongs to a different target case.",
      "Run preflight under the exact as-built target case.",
    );
  }
  if (
    receipt.asBuiltReceiptDigest !== asBuilt.receiptDigest ||
    receipt.buildManifestDigest !== asBuilt.buildManifestDigest ||
    receipt.qualificationContractDigest !== asBuilt.qualificationContractDigest
  ) {
    addFinding(
      findings,
      "preflight_upstream_digest_mismatch",
      "Preflight is not bound to the exact as-built, manifest, and qualification chain.",
      "Regenerate preflight after restoring the current receipt and qualification digests.",
    );
  }
  if (
    Date.parse(receipt.preflightAt) < Date.parse(asBuilt.completedAt) ||
    Date.parse(request.admittedAt) < Date.parse(receipt.preflightAt)
  ) {
    addFinding(
      findings,
      "preflight_time_order_invalid",
      "Preflight predates completed assembly or is admitted before the readiness checks complete.",
      "Restore chronology across assembly completion, preflight, and admission.",
    );
  }

  const requiredFixtureIds = dedupe(
    scenarios.flatMap((scenario) => stringArray(scenario.fixtureIds)),
  );
  const fixtureById = new Map(
    receipt.fixtureChecks.map((item) => [item.fixtureId, item]),
  );
  for (const fixtureId of requiredFixtureIds) {
    const check = fixtureById.get(fixtureId);
    if (!check) {
      addFinding(
        findings,
        "fixture_check_missing",
        `Qualification fixture ${fixtureId} has no preflight check.`,
        "Verify the exact fixture and configuration before reserving a run.",
        { fixtureId },
      );
      continue;
    }
    if (check.state !== "ready" || check.evidenceIds.length === 0) {
      addFinding(
        findings,
        "fixture_not_ready",
        `Qualification fixture ${fixtureId} is not ready with evidence custody.`,
        "Resolve fixture readiness and preserve its configuration evidence.",
        { fixtureId },
      );
    }
    if (!check.configurationDigest.trim()) {
      addFinding(
        findings,
        "fixture_configuration_mismatch",
        `Qualification fixture ${fixtureId} lacks an immutable configuration digest.`,
        "Digest the exact fixture configuration used for this run reservation.",
        { fixtureId },
      );
    }
    if (!timeInside(check.verifiedAt, asBuilt.completedAt, receipt.preflightAt)) {
      addFinding(
        findings,
        "evidence_time_order_invalid",
        `Fixture ${fixtureId} readiness was not verified between assembly completion and preflight.`,
        "Repeat and receipt fixture verification inside the current preflight window.",
        { fixtureId },
      );
    }
  }

  const instrumentById = new Map(
    receipt.instrumentationChecks.map((item) => [item.instrumentationId, item]),
  );
  for (const instrument of instruments) {
    const id = String(instrument.id ?? "");
    const check = instrumentById.get(id);
    const manifestInstrument = manifestInstruments.get(id);
    if (!check) {
      addFinding(
        findings,
        "instrumentation_check_missing",
        `Qualification instrument ${id} has no preflight check.`,
        "Verify the exact instrument, calibration, storage, and clock state.",
        { instrumentationId: id },
      );
      continue;
    }
    if (
      check.exactModelOrVersion !== String(instrument.modelOrVersion ?? "") ||
      (manifestInstrument !== undefined &&
        check.exactModelOrVersion !== manifestInstrument.exactModelOrVersion)
    ) {
      addFinding(
        findings,
        "instrumentation_identity_mismatch",
        `Instrument ${id} differs from the frozen qualification or build-manifest version.`,
        "Restore the frozen instrument identity or supersede qualification.",
        { instrumentationId: id },
      );
    }
    if (
      !manifestInstrument ||
      check.configurationDigest !== manifestInstrument.configurationDigest
    ) {
      addFinding(
        findings,
        "instrumentation_configuration_mismatch",
        `Instrument ${id} does not preserve the frozen build-manifest configuration digest.`,
        "Restore the exact instrument configuration or supersede the build and qualification chain.",
        { instrumentationId: id },
      );
    }
    if ((check.clockSource ?? "") !== String(instrument.clockSource ?? "")) {
      addFinding(
        findings,
        "instrumentation_clock_source_mismatch",
        `Instrument ${id} changes the frozen qualification clock source.`,
        "Restore the exact clock source and rerun synchronization checks.",
        { instrumentationId: id },
      );
    }
    if (
      check.calibrationState !== String(instrument.calibrationState ?? "") ||
      (manifestInstrument !== undefined &&
        check.calibrationState !== manifestInstrument.calibrationState) ||
      !["current", "not_required"].includes(check.calibrationState) ||
      check.state !== "ready" ||
      (check.calibrationState === "current" &&
        check.calibrationEvidenceIds.length === 0)
    ) {
      addFinding(
        findings,
        "instrumentation_calibration_invalid",
        `Instrument ${id} is not in the frozen, receipted calibration state.`,
        "Calibrate or replace the instrument and rerun preflight.",
        { instrumentationId: id },
      );
    }
    if (
      check.storagePath !== String(instrument.storagePath ?? "") ||
      (manifestInstrument !== undefined &&
        check.storagePath !== manifestInstrument.storagePath) ||
      !check.storageVerified ||
      check.evidenceIds.length === 0
    ) {
      addFinding(
        findings,
        "instrumentation_storage_unverified",
        `Instrument ${id} does not preserve the frozen storage path with readiness evidence.`,
        "Verify writable raw-data custody at the exact qualification path.",
        { instrumentationId: id },
      );
    }
  }

  const operatorById = new Map(
    receipt.operatorChecks.map((item) => [item.humanRoleId, item]),
  );
  for (const role of roles) {
    const id = String(role.humanRoleId ?? "");
    const check = operatorById.get(id);
    if (!check) {
      addFinding(
        findings,
        "operator_check_missing",
        `Architecture human role ${id} has no preflight assignment.`,
        "Assign a trained actor and receipt training and authority acknowledgement.",
        { humanRoleId: id },
      );
      continue;
    }
    if (
      check.state !== "ready" ||
      check.trainingEvidenceIds.length === 0 ||
      !check.authorityBoundaryAcknowledged
    ) {
      addFinding(
        findings,
        "operator_not_ready",
        `Human role ${id} is not ready with training and authority custody.`,
        "Complete role training and acknowledge the exact authority boundary.",
        { humanRoleId: id },
      );
    }
    const requiredResponsibilities = stringArray(role.responsibilities);
    if (
      !requiredResponsibilities.every((item) =>
        check.responsibilitiesAcknowledged.includes(item),
      )
    ) {
      addFinding(
        findings,
        "operator_scope_mismatch",
        `Human role ${id} has not acknowledged every frozen responsibility.`,
        "Acknowledge the complete target role before the run.",
        { humanRoleId: id },
      );
    }
  }

  const authorizationById = new Map(
    receipt.authorizationChecks.map((item) => [item.authorizationId, item]),
  );
  for (const authorization of authorizations) {
    const id = String(authorization.id ?? "");
    const check = authorizationById.get(id);
    if (!check) {
      addFinding(
        findings,
        "authorization_check_missing",
        `Qualification authorization ${id} has no preflight check.`,
        "Resolve venue and activity authority before reserving a run.",
        { authorizationId: id },
      );
      continue;
    }
    const expectedState = String(authorization.state ?? "");
    const admissible =
      expectedState === "not_required"
        ? check.state === "not_required"
        : check.state === "satisfied";
    if (
      !admissible ||
      check.evidenceIds.length === 0 ||
      (check.state === "satisfied" && check.authorityRefs.length === 0)
    ) {
      addFinding(
        findings,
        "authorization_not_satisfied",
        `Authorization ${id} is not satisfied with authority and evidence custody.`,
        "Acquire or receipt the exact authority before the run.",
        { authorizationId: id },
      );
    }
    if (
      !exactSet(
        check.permittedActivities,
        stringArray(authorization.permittedActivities),
      ) ||
      !exactSet(
        check.prohibitedActivities,
        stringArray(authorization.prohibitedActivities),
      )
    ) {
      addFinding(
        findings,
        "authorization_scope_mismatch",
        `Authorization ${id} changes the frozen permitted or prohibited activity boundary.`,
        "Restore the exact qualification authority scope or supersede the contract.",
        { authorizationId: id },
      );
    }
  }

  const hasActiveScenario = scenarios.some(
    (scenario) => scenario.activeEffect === true,
  );
  if (receipt.hazardControls.length === 0) {
    addFinding(
      findings,
      "hazard_control_missing",
      "The preflight receipt contains no explicit hazard determination.",
      "Record at least one controlled or not-applicable hazard determination with evidence.",
    );
  }
  if (
    receipt.hazardControls.some(
      (item) => item.state === "open" || item.evidenceIds.length === 0,
    ) ||
    (hasActiveScenario &&
      !receipt.hazardControls.some((item) => item.state === "controlled"))
  ) {
    addFinding(
      findings,
      "hazard_control_open",
      "At least one hazard remains open, lacks evidence, or an active scenario lacks a controlled hazard record.",
      "Close every applicable hazard under a named owner and evidence record.",
    );
  }

  const requiredInstrumentIds = instruments.map((item) =>
    String(item.id ?? ""),
  );
  if (
    receipt.clockCheck.state !== "ready" ||
    !exactSet(
      receipt.clockCheck.synchronizedInstrumentationIds,
      requiredInstrumentIds,
    ) ||
    !requiredInstrumentIds.includes(receipt.clockCheck.clockSource) ||
    receipt.clockCheck.measuredSkewMs >
      receipt.clockCheck.maximumAllowedSkewMs ||
    receipt.clockCheck.evidenceIds.length === 0
  ) {
    addFinding(
      findings,
      "clock_check_incomplete",
      "The target clock policy does not cover every qualification instrument or measured skew exceeds the frozen limit.",
      "Synchronize all instruments under the frozen clock source and measure admissible skew.",
    );
  }

  const requiredPaths = instruments.map((item) =>
    String(item.storagePath ?? ""),
  );
  if (
    receipt.storageCheck.state !== "ready" ||
    !receipt.storageCheck.writable ||
    !exactSet(receipt.storageCheck.requiredPaths, requiredPaths) ||
    !exactSet(receipt.storageCheck.verifiedPaths, requiredPaths) ||
    receipt.storageCheck.evidenceIds.length === 0
  ) {
    addFinding(
      findings,
      "storage_check_incomplete",
      "Raw-data storage is not writable and exactly verified for every frozen path.",
      "Verify capacity, retention, and write custody at every qualification storage path.",
    );
  }

  const abortAuthorities = dedupe(
    authorizations.flatMap((item) => stringArray(item.abortAuthority)),
  );
  if (
    receipt.abortCheck.state !== "ready" ||
    !abortAuthorities.every((actor) =>
      receipt.abortCheck.authorityActors.includes(actor),
    ) ||
    receipt.abortCheck.evidenceIds.length === 0
  ) {
    addFinding(
      findings,
      "abort_check_incomplete",
      "The abort path is not tested for every frozen abort authority.",
      "Exercise and receipt the abort mechanism before the run.",
    );
  }
  if (
    !timeInside(
      receipt.abortCheck.testedAt,
      asBuilt.completedAt,
      receipt.preflightAt,
    )
  ) {
    addFinding(
      findings,
      "evidence_time_order_invalid",
      "The abort path was not tested inside the current preflight window.",
      "Retest and receipt the abort mechanism after assembly and before preflight admission.",
    );
  }

  const scenarioIds = new Set(
    scenarios.map((item) => String(item.id ?? "")),
  );
  const reservationIds = receipt.runReservations.map((item) => item.runId);
  const reservationReceiptIds = receipt.runReservations.map(
    (item) => item.reservationReceiptId,
  );
  if (
    new Set(reservationIds).size !== reservationIds.length ||
    new Set(reservationReceiptIds).size !== reservationReceiptIds.length
  ) {
    addFinding(
      findings,
      "run_reservation_duplicate",
      "The preflight receipt contains duplicate run or reservation-receipt identifiers.",
      "Reserve globally unique run and reservation identifiers under the exact preflight digest.",
    );
  }
  for (const scenarioId of scenarioIds) {
    if (!receipt.runReservations.some((item) => item.scenarioId === scenarioId)) {
      addFinding(
        findings,
        "run_reservation_missing",
        `Qualification scenario ${scenarioId} has no run reservation.`,
        "Reserve at least one unique run identifier for every required scenario.",
      );
    }
  }
  for (const reservation of receipt.runReservations) {
    if (!scenarioIds.has(reservation.scenarioId)) {
      addFinding(
        findings,
        "run_reservation_scenario_invalid",
        `Run ${reservation.runId} references unknown scenario ${reservation.scenarioId}.`,
        "Bind every run reservation to a frozen qualification scenario.",
        { runId: reservation.runId },
      );
    }
    if (
      !timeInside(
        reservation.reservedAt,
        asBuilt.completedAt,
        receipt.preflightAt,
      )
    ) {
      addFinding(
        findings,
        "evidence_time_order_invalid",
        `Run ${reservation.runId} was not reserved inside the current preflight window.`,
        "Reserve the run after assembly completion and before preflight admission.",
        { runId: reservation.runId },
      );
    }
  }

  const evidenceIds = new Set(
    receipt.evidence.map((item) => item.evidenceId),
  );
  const missingEvidence = referencedEvidenceIds(receipt).filter(
    (id) => !evidenceIds.has(id),
  );
  if (missingEvidence.length > 0) {
    addFinding(
      findings,
      "evidence_custody_missing",
      `Preflight references unknown evidence: ${dedupe(missingEvidence).join(", ")}.`,
      "Add immutable evidence records for every readiness assertion.",
    );
  }
  const futureEvidence = receipt.evidence.filter(
    (item) => Date.parse(item.capturedAt) > Date.parse(receipt.preflightAt),
  );
  if (futureEvidence.length > 0) {
    addFinding(
      findings,
      "evidence_time_order_invalid",
      `Preflight evidence was captured after preflight: ${futureEvidence
        .map((item) => item.evidenceId)
        .join(", ")}.`,
      "Capture and digest readiness evidence before preflight admission.",
    );
  }
  if (receipt.state !== "ready") {
    addFinding(
      findings,
      "preflight_state_not_ready",
      "The preflight receipt is not ready.",
      "Resolve every readiness finding before issuing a run.",
    );
  }
  if (receipt.qualificationTransferred !== false) {
    addFinding(
      findings,
      "qualification_transfer_attempted",
      "Preflight attempts to transfer qualification into the target run.",
      "Keep qualification transfer false and execute the reserved target run.",
    );
  }
  if (receipt.missionEquivalenceClaimed !== false) {
    addFinding(
      findings,
      "mission_equivalence_attempted",
      "Preflight attempts to claim mission equivalence before a test result exists.",
      "Keep mission equivalence false through preflight and execution.",
    );
  }

  const readiness = readinessFromFindings(findings);
  const ordinaryPreflightGate = runPreflightGate({
    expectedManifestDigest: receipt.buildManifestDigest,
    expectedQualificationContractDigest: receipt.qualificationContractDigest,
    buildReceipt: toOrdinaryBuildReceipt(asBuilt),
    readiness,
  });
  if (!ordinaryPreflightGate.passed) {
    addFinding(
      findings,
      "ordinary_preflight_not_admitted",
      `The ordinary preflight gate refused readiness: ${ordinaryPreflightGate.blockingReasons.join(
        "; ",
      )}.`,
      "Resolve the ordinary manifest, qualification, build-state, deviation, and readiness findings.",
    );
  }

  const blockingStates = new Set<CommonsSeededPreflightFinding["state"]>([
    "seeded_build_receipt_result_mismatch",
    "seeded_build_receipt_not_admitted",
    "preflight_receipt_digest_mismatch",
    "preflight_case_mismatch",
    "preflight_upstream_digest_mismatch",
    "qualification_transfer_attempted",
    "mission_equivalence_attempted",
  ]);
  const state =
    findings.length === 0 && ordinaryPreflightGate.passed
      ? "seeded_preflight_admitted"
      : findings.some((item) => blockingStates.has(item.state))
        ? "seeded_preflight_blocked"
        : "seeded_preflight_incomplete";

  return {
    passed: state === "seeded_preflight_admitted",
    state,
    seededBuildReceiptResult: priorResult,
    seededBuildReceiptResultDigest: priorDigest,
    preflightReceiptDigest: receiptDigest,
    asBuiltReceiptDigest: asBuilt.receiptDigest,
    readyFixtureIds: receipt.fixtureChecks
      .filter((item) => item.state === "ready")
      .map((item) => item.fixtureId),
    readyInstrumentationIds: receipt.instrumentationChecks
      .filter((item) => item.state === "ready")
      .map((item) => item.instrumentationId),
    readyHumanRoleIds: receipt.operatorChecks
      .filter((item) => item.state === "ready")
      .map((item) => item.humanRoleId),
    satisfiedAuthorizationIds: receipt.authorizationChecks
      .filter((item) => ["satisfied", "not_required"].includes(item.state))
      .map((item) => item.authorizationId),
    reservedRunIds: receipt.runReservations.map((item) => item.runId),
    findings,
    validationErrors: [],
    ordinaryPreflightGate,
    preflightReceipt: receipt,
    pullList: dedupe(findings.map((item) => item.requiredAction)),
    prohibitedTransitions: [
      ...COMMONS_SEEDED_PREFLIGHT_PROHIBITED_TRANSITIONS,
    ],
  };
}
