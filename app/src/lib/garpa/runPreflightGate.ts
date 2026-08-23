import type {
  PreflightGateInput,
  PreflightGateResult,
} from "../../types/garpaExecution";

const READINESS_LABELS: Record<keyof PreflightGateInput["readiness"], string> = {
  fixtureReady: "fixture is not ready",
  instrumentationReady: "instrumentation is not ready",
  calibrationReady: "required calibration is not current",
  storageReady: "raw-data storage is not ready",
  clocksReady: "clock synchronization is not ready",
  authorityReady: "required venue or test authority is absent",
  hazardControlsReady: "hazard controls are not ready",
  abortPathReady: "abort authority or abort path is not ready",
  operatorRolesReady: "required operator roles are unresolved",
  runIdReserved: "run identifier is not reserved",
};

export function runPreflightGate(input: PreflightGateInput): PreflightGateResult {
  const { buildReceipt, readiness } = input;
  const manifestCurrent = buildReceipt.manifestDigest === input.expectedManifestDigest;
  const qualificationContractCurrent =
    buildReceipt.qualificationContractDigest === input.expectedQualificationContractDigest;
  const buildStateAdmissible = buildReceipt.state === "assembled";
  const materialDeviationsClosed = !buildReceipt.deviations.some(
    (deviation) =>
      (deviation.severity === "material" || deviation.severity === "unsafe") &&
      deviation.closureState === "open",
  );

  const blockingReasons: string[] = [];
  if (!manifestCurrent) blockingReasons.push("build receipt references a stale manifest digest");
  if (!qualificationContractCurrent) {
    blockingReasons.push("build receipt references a stale qualification-contract digest");
  }
  if (!buildStateAdmissible) blockingReasons.push("build state is not assembled");
  if (!materialDeviationsClosed) {
    blockingReasons.push("an open material or unsafe build deviation remains");
  }

  for (const [key, ready] of Object.entries(readiness) as Array<
    [keyof typeof readiness, boolean]
  >) {
    if (!ready) blockingReasons.push(READINESS_LABELS[key]);
  }

  return {
    passed: blockingReasons.length === 0,
    manifestCurrent,
    qualificationContractCurrent,
    buildStateAdmissible,
    materialDeviationsClosed,
    readiness,
    blockingReasons,
  };
}
