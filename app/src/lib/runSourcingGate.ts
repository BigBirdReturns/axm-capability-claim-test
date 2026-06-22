import type {
  Claim,
  EvidenceClass,
  Ledger,
  LoadBearingFieldStatus,
  SourcingGateResult,
} from "../types/audit";
import { OBJECT_ROUTES } from "../data/objectRoutes";
import { SOURCING_THRESHOLD, fieldsForSet } from "../data/loadBearingFields";

// Evidence classes that do NOT count as external sourcing toward the gate.
// "open" is an explicitly unsourced placeholder. "judgment" is the analyst's
// own interpretive call — it can be recorded and shown as known evidence, but
// three judgments are not three sources, so it never unlocks a verdict on its
// own. The gate exists to require EXTERNAL anchoring (confirmed / reported /
// derived); letting judgment count would let an analyst freehand past it.
const NON_SOURCING_CLASSES: ReadonlySet<EvidenceClass> = new Set<EvidenceClass>([
  "open",
  "judgment",
]);

// A claim is "sourced" (counts toward the gate) iff its evidence class is an
// external class (not open, not judgment) AND it cites at least one source that
// RESOLVES to a real source in the ledger. Resolving the ids here (not only in
// validateLedger) makes the gate self-contained: any door that builds a Ledger —
// the web app, the MCP server, a test fixture — gets the same guarantee even if
// it skipped validation. A claim citing a phantom id is not sourced.
export function isClaimSourced(claim: Claim, validSourceIds?: Set<string>): boolean {
  if (NON_SOURCING_CLASSES.has(claim.evidenceClass)) return false;
  const cited = validSourceIds
    ? claim.sourceIds.filter((id) => validSourceIds.has(id))
    : claim.sourceIds;
  return cited.length > 0;
}

// Step 1. Sourcing gate (the stop rule). No verdict below three sourced
// load-bearing fields. Returns the field-by-field status used to either
// unlock the verdict or emit a pull-list.
export function runSourcingGate(ledger: Ledger): SourcingGateResult {
  const def = OBJECT_ROUTES[ledger.objectType];
  const fields = fieldsForSet(def.fieldSet);
  const validSourceIds = new Set(ledger.sources.map((s) => s.id));

  const statuses: LoadBearingFieldStatus[] = fields.map((f) => {
    const claimsForField = ledger.claims.filter((c) => c.field === f.field);
    const sourcedClaim = claimsForField.find((c) => isClaimSourced(c, validSourceIds));
    return {
      field: f.field,
      label: f.label,
      sourced: Boolean(sourcedClaim),
      evidenceClass: sourcedClaim?.evidenceClass ?? claimsForField[0]?.evidenceClass,
    };
  });

  const sourcedCount = statuses.filter((s) => s.sourced).length;

  return {
    required: SOURCING_THRESHOLD,
    sourcedCount,
    passed: sourcedCount >= SOURCING_THRESHOLD,
    fields: statuses,
    missing: statuses.filter((s) => !s.sourced),
  };
}
