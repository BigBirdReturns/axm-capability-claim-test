import type {
  ContaminationBucket,
  ContaminationComponent,
  ContaminationResult,
  Ledger,
} from "../types/audit";
import { CONTAMINATION_COMPONENTS } from "../data/contaminationComponents";

// Step 6. Reading contamination — a bucket, with reasons, never a bare number.
// Internal component scores may be stored, but public output is bucket plus
// source-backed component reasons.
//
// Internal-only mapping (never rendered): 0–24 clean, 25–74 mixed /
// network-dependent, 75–100 circular. A component with no source-backed reason
// does not contribute; if nothing is sourced, the bucket is insufficient_data.
export function runContaminationBucket(ledger: Ledger): ContaminationResult {
  const annotation = ledger.contamination;

  const components: ContaminationComponent[] = CONTAMINATION_COMPONENTS.map((def) => {
    const fromLedger = annotation?.components?.find((c) => c.key === def.key);
    const present = fromLedger?.present === true;
    const reason = fromLedger?.reason?.trim() ?? "";
    const sourceIds = fromLedger?.sourceIds ?? [];
    // A component only counts when it is present AND has a source-backed reason.
    // An author-supplied internalScore is honored ONLY when source-backed — an
    // unsourced component scores 0 and cannot move the bucket. This is the
    // bare-assertion guard the doctrine requires.
    const sourceBacked = present && reason.length > 0 && sourceIds.length > 0;
    return {
      key: def.key,
      label: def.label,
      reason: reason || "No sourced finding on this component.",
      sourceIds,
      internalScore: sourceBacked ? (fromLedger?.internalScore ?? 100) : 0,
      present: sourceBacked,
    };
  });

  // Only source-backed components are ever considered. present === sourceBacked.
  const sourceBackedComponents = components.filter((c) => c.present);

  let bucket: ContaminationBucket;
  if (annotation?.bucket) {
    // An explicit bucket may be honored, but a bucket that ASSERTS contamination
    // (mixed/circular) still requires at least one source-backed component —
    // otherwise it is a bare number wearing a bucket's clothes. Downgrade to
    // insufficient_data rather than print an unsourced assertion.
    const assertsContamination =
      annotation.bucket === "mixed" || annotation.bucket === "circular";
    if (assertsContamination && sourceBackedComponents.length === 0) {
      bucket = "insufficient_data";
    } else {
      bucket = annotation.bucket;
    }
  } else if (sourceBackedComponents.length === 0) {
    bucket = "insufficient_data";
  } else {
    const avg =
      sourceBackedComponents.reduce((sum, c) => sum + (c.internalScore ?? 0), 0) /
      sourceBackedComponents.length;
    bucket = avg >= 75 ? "circular" : avg >= 25 ? "mixed" : "clean";
  }

  return { bucket, components };
}

export const BUCKET_LABELS: Record<ContaminationBucket, string> = {
  clean: "Clean",
  mixed: "Mixed / network-dependent",
  circular: "Circular",
  insufficient_data: "Insufficient data",
};
