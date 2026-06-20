import type { Ledger, SeamResult } from "../types/audit";
import { OBJECT_ROUTES } from "../data/objectRoutes";
import { seamsForFieldSet } from "../data/seams";

// Resolve formal seam states for the object's seam set. Annotations from the
// audit run are honored; un-annotated seams default to "unclear" (an open
// question, not a signal). not_applicable seams are carried but, per the
// method, never counted as weak signal.
export function runSeams(ledger: Ledger): SeamResult[] {
  const def = OBJECT_ROUTES[ledger.objectType];
  const seamDefs = seamsForFieldSet(def.fieldSet);

  return seamDefs.map((seam) => {
    const annotation = ledger.seams?.find((s) => s.id === seam.id);
    return {
      id: seam.id,
      question: annotation?.question ?? seam.question,
      state: annotation?.state ?? "unclear",
      reason: annotation?.reason ?? "Not yet resolved against the ledger.",
      sourceIds: annotation?.sourceIds ?? [],
    };
  });
}

// Weak-signal count: triggered seams only. not_applicable is never weak
// signal, and unclear is an open question rather than a signal.
export function weakSignalCount(seams: SeamResult[]): number {
  return seams.filter((s) => s.state === "triggered").length;
}
