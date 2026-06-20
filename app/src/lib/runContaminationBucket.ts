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
    const sourceBacked = present && reason.length > 0 && sourceIds.length > 0;
    return {
      key: def.key,
      label: def.label,
      reason: reason || "No sourced finding on this component.",
      sourceIds,
      internalScore:
        fromLedger?.internalScore ?? (sourceBacked ? 100 : present ? 50 : 0),
      present: sourceBacked,
    };
  });

  // If the ledger supplied an explicit bucket, honor it (the analysis layer
  // already read the cell). Otherwise derive from source-backed components.
  let bucket: ContaminationBucket;
  if (annotation?.bucket) {
    bucket = annotation.bucket;
  } else {
    const considered = components.filter(
      (c) => c.present || (c.internalScore ?? 0) > 0,
    );
    if (considered.length === 0) {
      bucket = "insufficient_data";
    } else {
      const avg =
        considered.reduce((sum, c) => sum + (c.internalScore ?? 0), 0) /
        considered.length;
      bucket = avg >= 75 ? "circular" : avg >= 25 ? "mixed" : "clean";
    }
  }

  return { bucket, components };
}

export const BUCKET_LABELS: Record<ContaminationBucket, string> = {
  clean: "Clean",
  mixed: "Mixed / network-dependent",
  circular: "Circular",
  insufficient_data: "Insufficient data",
};
