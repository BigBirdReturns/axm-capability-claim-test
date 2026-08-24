import type {
  CommonsSeededPreflightFinding,
  CommonsSeededPreflightReceipt,
  CommonsSeededPreflightRequest,
  CommonsSeededPreflightResult,
} from "../../types/garpaCommonsSeededPreflight";
import { canonicalStringify } from "./canonicalJson";
import { computeCommonsSeededPreflightReceiptDigest } from "./commonsSeededPreflightDigest";
import { runCommonsSeededBuildReceiptGate } from "./runCommonsSeededBuildReceiptGate";
import { sha256Hex } from "./sha256";
import { validateCommonsSeededPreflightRequest } from "./validateCommonsSeededPreflight";

export const COMMONS_SEEDED_PREFLIGHT_PROHIBITED_TRANSITIONS = [
  "A ready preflight receipt does not constitute a test result, qualification result, deployment result, or mission-equivalence claim.",
  "A run reservation is valid only for the exact as-built receipt, qualification scenario, instrumentation, authority, and preflight digest.",
  "Any changed installed identity, firmware, configuration, fixture, instrumentation, authorization, operator, storage path, clock policy, or hazard boundary invalidates preflight.",
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

function findQualificationContract(request: CommonsSeededPreflightRequest): RecordValue {
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
        requiredAction: "Repair the seeded preflight request and rerun validation.",
      })),
      validationErrors: validated.errors,
      pullList: validated.errors,
      prohibitedTransitions: [...COMMONS_SEEDED_PREFLIGHT_PROHIBITED_TRANSITIONS],
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
  const scenarios = recordArray(qualification.scenarios);
  const instruments = recordArray(qualification.instrumentation);
  const authorizations = recordArray(qualification.authorizations);
  const roles = recordArray(architecture.humanRoleSelections);
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
  }

  const instrumentById = new Map(
    receipt.instrumentationChecks.map((item) => [item.instrumentationId, item]),
  );
  for (const instrument of instruments) {
    const id = String(instrument.id ?? "");
    const check = instrumentById.get(id);
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
    if (check.exactModelOrVersion !== String(instrument.modelOrVersion ?? "")) {
      addFinding(
        findings,
        "instrumentation_identity_mismatch",
        `Instrument ${id} differs from the frozen qualification version.`,
        "Restore the frozen instrument identity or supersede qualification.",
        { instrumentationId: id },
      );
    }
    if (!check.configurationDigest.trim()) {
      addFinding(
        findings,
        "instrumentation_configuration_mismatch",
        `Instrument ${id} lacks a preflight configuration digest.`,
        "Digest the exact instrument configuration before the run.",
        { instrumentationId: id },
      );
    }
    if (
      check.calibrationState !== String(instrument.calibrationState ?? "") ||
      !["current", "not_required"].includes(check.calibrationState) ||
      check.state !== "ready"
    ) {
      addFinding(
        findings,
        "instrumentation_calibration_invalid",
        `Instrument ${id} is not in the frozen, admissible calibration state.`,
        "Calibrate or replace the instrument and rerun preflight.",
        { instrumentationId: id },
      );
    }
    if (
      check.storagePath !== String(instrument.storagePath ?? "") ||
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
    if (!requiredResponsibilities.every((item) => check.responsibilitiesAcknowledged.includes(item))) {
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
    const admissible = expectedState === "not_required"
      ? check.state === "not_required"
      : check.state === "satisfied";
    if (!admissible || check.evidenceIds.length === 0) {
      addFinding(
        findings,
        "authorization_not_satisfied",
        `Authorization ${id} is not satisfied for the frozen venue and activities.`,
        "Acquire or receipt the exact authority before the run.",
        { authorizationId: id },
      );
    }
    if (
      !exactSet(check.permittedActivities, stringArray(authorization.permittedActivities)) ||
      !exactSet(check.prohibitedActivities, stringArray(authorization.prohibitedActivities))
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

  const hasActiveScenario = scenarios.some((scenario) => scenario.activeEffect === true);
  if (
    receipt.hazardControls.some((item) => item.state === "open") ||
    (hasActiveScenario && !receipt.hazardControls.some((item) => item.state === "controlled"))
  ) {
    addFinding(
      findings,
      "hazard_control_open",
      "At least one applicable hazard remains open or an active scenario lacks a controlled hazard record.",
      "Close every applicable hazard under a named owner and evidence record.",
    );
  }

  const requiredInstrumentIds = instruments.map((item) => String(item.id ?? ""));
  if (
    receipt.clockCheck.state !== "ready" ||
    !requiredInstrumentIds.every((id) =>
      receipt.clockCheck.synchronizedInstrumentationIds.includes(id),
    ) ||
    receipt.clockCheck.evidenceIds.length === 0
  ) {
    addFinding(
      findings,
      "clock_check_incomplete",
      "The target clock policy does not cover every qualification instrument with evidence.",
      "Synchronize all instruments under the frozen clock source and measure skew.",
    );
  }

  const requiredPaths = instruments.map((item) => String(item.storagePath ?? ""));
  if (
    receipt.storageCheck.state !== "ready" ||
    !receipt.storageCheck.writable ||
    !requiredPaths.every((path) => receipt.storageCheck.requiredPaths.includes(path)) ||
    !requiredPaths.every((path) => receipt.storageCheck.verifiedPaths.includes(path)) ||
    receipt.storageCheck.evidenceIds.length === 0
  ) {
    addFinding(
      findings,
      "storage_check_incomplete",
      "Raw-data storage is not writable and verified for every frozen path.",
      "Verify capacity, retention, and write custody at every qualification storage path.",
    );
  }

  const abortAuthorities = dedupe(
    authorizations.flatMap((item) => stringArray(item.abortAuthority)),
  );
  if (
    receipt.abortCheck.state !== "ready" ||
    !abortAuthorities.every((actor) => receipt.abortCheck.authorityActors.includes(actor)) ||
    receipt.abortCheck.evidenceIds.length === 0
  ) {
    addFinding(
      findings,
      "abort_check_incomplete",
      "The abort path is not tested for every frozen abort authority.",
      "Exercise and receipt the abort mechanism before the run.",
    );
  }

  const scenarioIds = new Set(scenarios.map((item) => String(item.id ?? "")));
  const reservationIds = receipt.runReservations.map((item) => item.runId);
  if (new Set(reservationIds).size !== reservationIds.length) {
    addFinding(
      findings,
      "run_reservation_duplicate",
      "The preflight receipt contains duplicate run identifiers.",
      "Reserve globally unique run identifiers under the exact preflight digest.",
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
  }

  const evidenceIds = new Set(receipt.evidence.map((item) => item.evidenceId));
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

  const blockingStates = new Set<CommonsSeededPreflightFinding["state"]>([
    "seeded_build_receipt_result_mismatch",
    "seeded_build_receipt_not_admitted",
    "preflight_receipt_digest_mismatch",
    "preflight_case_mismatch",
    "preflight_upstream_digest_mismatch",
    "qualification_transfer_attempted",
    "mission_equivalence_attempted",
  ]);
  const state = findings.length === 0
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
    preflightReceipt: receipt,
    pullList: dedupe(findings.map((item) => item.requiredAction)),
    prohibitedTransitions: [...COMMONS_SEEDED_PREFLIGHT_PROHIBITED_TRANSITIONS],
  };
}
