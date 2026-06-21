import type {
  Claim,
  Ledger,
  LoadBearingFieldStatus,
  SourcingGateResult,
} from "../types/audit";
import { OBJECT_ROUTES } from "../data/objectRoutes";
import { SOURCING_THRESHOLD, fieldsForSet } from "../data/loadBearingFields";

// A claim is "sourced" iff it cites at least one source that RESOLVES to a real
// source in the ledger, and its evidence class is not "open". Resolving the ids
// here (not only in validateLedger) makes the gate self-contained: any door that
// builds a Ledger — the web app, the MCP server, a test fixture — gets the same
// guarantee even if it skipped validation. A claim citing a phantom id is not
// sourced.
export function isClaimSourced(claim: Claim, validSourceIds?: Set<string>): boolean {
  if (claim.evidenceClass === "open") return false;
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
