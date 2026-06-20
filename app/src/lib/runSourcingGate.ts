import type {
  Claim,
  Ledger,
  LoadBearingFieldStatus,
  SourcingGateResult,
} from "../types/audit";
import { OBJECT_ROUTES } from "../data/objectRoutes";
import { SOURCING_THRESHOLD, fieldsForSet } from "../data/loadBearingFields";

// A claim is "sourced" iff it cites at least one source and its evidence class
// is not "open". An open claim is a question, not evidence.
export function isClaimSourced(claim: Claim): boolean {
  return claim.sourceIds.length > 0 && claim.evidenceClass !== "open";
}

// Step 1. Sourcing gate (the stop rule). No verdict below three sourced
// load-bearing fields. Returns the field-by-field status used to either
// unlock the verdict or emit a pull-list.
export function runSourcingGate(ledger: Ledger): SourcingGateResult {
  const def = OBJECT_ROUTES[ledger.objectType];
  const fields = fieldsForSet(def.fieldSet);

  const statuses: LoadBearingFieldStatus[] = fields.map((f) => {
    const claimsForField = ledger.claims.filter((c) => c.field === f.field);
    const sourcedClaim = claimsForField.find(isClaimSourced);
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
