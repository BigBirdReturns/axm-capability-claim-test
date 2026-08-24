import type {
  CommonsSeededPreflightReceipt,
  CommonsSeededPreflightRequest,
  PreflightEvidenceRef,
} from "../../app/src/types/garpaCommonsSeededPreflight";
import { canonicalStringify } from "../../app/src/lib/garpa/canonicalJson";
import { computeCommonsSeededPreflightReceiptDigest } from "../../app/src/lib/garpa/commonsSeededPreflightDigest";
import { runCommonsSeededBuildReceiptGate } from "../../app/src/lib/garpa/runCommonsSeededBuildReceiptGate";
import { sha256Hex } from "../../app/src/lib/garpa/sha256";
import { buildSeededBuildReceiptRequest } from "./garpaCommonsSeededBuildReceiptFixture";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function records(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function after(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

export function buildSeededPreflightRequest(): CommonsSeededPreflightRequest {
  const seededBuildReceiptRequest = buildSeededBuildReceiptRequest();
  const priorResult = runCommonsSeededBuildReceiptGate(
    seededBuildReceiptRequest,
  );
  if (!priorResult.passed) throw new Error(JSON.stringify(priorResult));
  const priorDigest = sha256Hex(canonicalStringify(priorResult));
  const asBuilt = seededBuildReceiptRequest.asBuiltReceipt;
  const qualification = findObject(
    seededBuildReceiptRequest,
    (value) =>
      Array.isArray(value.scenarios) &&
      Array.isArray(value.instrumentation) &&
      Array.isArray(value.authorizations) &&
      isRecord(value.acceptanceRule),
  )!;
  const architecture = findObject(
    seededBuildReceiptRequest,
    (value) =>
      Array.isArray(value.componentSelections) &&
      Array.isArray(value.humanRoleSelections) &&
      Array.isArray(value.risks),
  )!;
  const buildManifest = findObject(
    seededBuildReceiptRequest,
    (value) =>
      typeof value.manifestDigest === "string" &&
      Array.isArray(value.components) &&
      Array.isArray(value.instrumentation) &&
      Array.isArray(value.assemblySteps),
  )!;
  const scenarios = records(qualification.scenarios);
  const instruments = records(qualification.instrumentation);
  const authorizations = records(qualification.authorizations);
  const roles = records(architecture.humanRoleSelections);
  const manifestInstruments = new Map(
    records(buildManifest.instrumentation).map((instrument) => [
      String(instrument.instrumentationId),
      instrument,
    ]),
  );
  const preflightAt = after(asBuilt.completedAt, 10);
  const admittedAt = after(asBuilt.completedAt, 15);

  const evidence: PreflightEvidenceRef[] = [];
  const ensureEvidence = (evidenceId: string): string => {
    if (!evidence.some((item) => item.evidenceId === evidenceId)) {
      evidence.push({
        evidenceId,
        sha256: sha256Hex(`preflight:${evidenceId}`),
        path: `preflight/${evidenceId}.json`,
        capturedAt: preflightAt,
      });
    }
    return evidenceId;
  };

  const fixtureIds = Array.from(
    new Set(scenarios.flatMap((scenario) => strings(scenario.fixtureIds))),
  );
  const fixtureChecks = fixtureIds.map((fixtureId) => ({
    fixtureId,
    configurationDigest: sha256Hex(`fixture-config:${fixtureId}`),
    state: "ready" as const,
    verifiedAt: preflightAt,
    verifiedBy: "GARPA target fixture owner",
    evidenceIds: [ensureEvidence(`fixture-ready-${fixtureId}`)],
  }));

  const instrumentationChecks = instruments.map((instrument) => {
    const id = String(instrument.id);
    const calibrationEvidenceId = ensureEvidence(`instrument-calibration-${id}`);
    return {
      instrumentationId: id,
      exactModelOrVersion: String(instrument.modelOrVersion),
      configurationDigest: String(
        manifestInstruments.get(id)?.configurationDigest ?? "",
      ),
      calibrationState: String(instrument.calibrationState) as
        | "current"
        | "not_required",
      calibrationEvidenceIds: [calibrationEvidenceId],
      storagePath: String(instrument.storagePath),
      storageVerified: true,
      clockSource:
        typeof instrument.clockSource === "string"
          ? instrument.clockSource
          : undefined,
      state: "ready" as const,
      evidenceIds: [ensureEvidence(`instrument-ready-${id}`)],
    };
  });

  const operatorChecks = roles.map((role) => {
    const id = String(role.humanRoleId);
    return {
      humanRoleId: id,
      actor: "GARPA target operator",
      trainingEvidenceIds: [ensureEvidence(`operator-training-${id}`)],
      responsibilitiesAcknowledged: strings(role.responsibilities),
      authorityBoundaryAcknowledged: true,
      state: "ready" as const,
    };
  });

  const authorizationChecks = authorizations.map((authorization) => {
    const id = String(authorization.id);
    const state = String(authorization.state) === "not_required"
      ? "not_required" as const
      : "satisfied" as const;
    return {
      authorizationId: id,
      state,
      authorityRefs: state === "satisfied" ? [`authority:${id}`] : [],
      permittedActivities: strings(authorization.permittedActivities),
      prohibitedActivities: strings(authorization.prohibitedActivities),
      evidenceIds: [ensureEvidence(`authorization-${id}`)],
    };
  });

  const requiredPaths = instruments.map((instrument) =>
    String(instrument.storagePath),
  );
  const instrumentIds = instruments.map((instrument) => String(instrument.id));
  const abortAuthorities = Array.from(
    new Set(authorizations.flatMap((authorization) => strings(authorization.abortAuthority))),
  );

  const receipt: CommonsSeededPreflightReceipt = {
    schemaVersion: 1,
    receiptId: "preflight:GARPA-COMMONS-TARGET-0001:v1",
    caseId: asBuilt.caseId,
    seededBuildReceiptResultDigest: priorDigest,
    asBuiltReceiptDigest: asBuilt.receiptDigest,
    buildManifestDigest: asBuilt.buildManifestDigest,
    qualificationContractDigest: asBuilt.qualificationContractDigest,
    fixtureChecks,
    instrumentationChecks,
    operatorChecks,
    authorizationChecks,
    hazardControls: [
      {
        hazardId: "hazard-passive-target-fixture",
        description: "The bounded target fixture contains no regulated active effect.",
        control: "Keep the fixture passive, isolated, and inside the frozen venue boundary.",
        owner: "GARPA target fixture owner",
        state: "not_applicable",
        evidenceIds: [ensureEvidence("hazard-passive-target-fixture")],
      },
    ],
    clockCheck: {
      clockPolicy: "one monotonic target run clock",
      clockSource: "instrument-target-clock",
      synchronizedInstrumentationIds: instrumentIds,
      maximumAllowedSkewMs: 10,
      measuredSkewMs: 2,
      state: "ready",
      evidenceIds: [ensureEvidence("clock-readiness")],
    },
    storageCheck: {
      requiredPaths,
      verifiedPaths: [...requiredPaths],
      retentionPolicy: "Retain raw events, logs, observations, and receipts for the complete case lifetime.",
      capacityCheck: "More than twice the bounded scenario estimate is available.",
      writable: true,
      state: "ready",
      evidenceIds: [ensureEvidence("storage-readiness")],
    },
    abortCheck: {
      authorityActors: abortAuthorities,
      mechanism: "Immediate fixture stop and process termination under the target operator console.",
      testMethod: "Exercise the abort path before the scored run and verify shutdown and receipt emission.",
      testedAt: preflightAt,
      state: "ready",
      evidenceIds: [ensureEvidence("abort-readiness")],
    },
    runReservations: scenarios.map((scenario, index) => ({
      runId: `GARPA-COMMONS-TARGET-0001-RUN-${String(index + 1).padStart(3, "0")}`,
      scenarioId: String(scenario.id),
      reservedAt: preflightAt,
      reservationReceiptId: `run-reservation-${String(index + 1).padStart(3, "0")}`,
      uniquenessEvidenceIds: [
        ensureEvidence(`run-reservation-${String(index + 1).padStart(3, "0")}`),
      ],
    })),
    evidence,
    preflightAt,
    state: "ready",
    qualificationTransferred: false,
    missionEquivalenceClaimed: false,
    receiptDigest: "0".repeat(64),
  };
  receipt.receiptDigest = computeCommonsSeededPreflightReceiptDigest(receipt);

  return {
    schemaVersion: 1,
    seededBuildReceiptRequest,
    expectedSeededBuildReceiptResultDigest: priorDigest,
    preflightReceipt: receipt,
    admittedAt,
  };
}
