import type {
  Claim,
  EvidenceClass,
  Ledger,
  LoadBearingFieldStatus,
  Source,
  SourcingGateResult,
} from "../types/audit";
import { OBJECT_ROUTES } from "../data/objectRoutes";
import { SOURCING_THRESHOLD, fieldsForSet } from "../data/loadBearingFields";

// Evidence classes that COUNT as external sourcing toward the gate. This is an
// allowlist, on purpose. The gate's job is to require external anchoring before
// any verdict, so only the externally-anchored classes unlock it:
//   confirmed — a primary/authoritative record states it;
//   reported  — a credible secondary source reports it;
//   derived   — computed/inferred from sourced facts.
// `open` is an explicit placeholder and `judgment` is the analyst's own call —
// neither is external evidence, so neither counts. An allowlist (rather than a
// "everything except open/judgment" blacklist) means an unknown or misspelled
// class — e.g. "confimed" arriving from a door that skipped validateLedger —
// fails closed instead of silently unlocking the gate.
const SOURCING_CLASSES: ReadonlySet<EvidenceClass> = new Set<EvidenceClass>([
  "confirmed",
  "reported",
  "derived",
]);

// A source is "usable" only if it carries at least one real detail. A blank
// draft row (created by the editor's "add source" before anything is typed)
// must not satisfy the gate — otherwise the gate counts an empty placeholder.
export function isUsableSource(source: Source): boolean {
  return Boolean(
    source.title?.trim() ||
      source.url?.trim() ||
      source.publisher?.trim() ||
      source.date?.trim() ||
      source.note?.trim(),
  );
}

// A claim is "sourced" (counts toward the gate) iff its evidence class is in the
// external allowlist AND it cites at least one source that RESOLVES to a usable
// source in the ledger. Resolving the ids here (not only in validateLedger)
// makes the gate self-contained: any door that builds a Ledger — the web app,
// the MCP server, a test fixture — gets the same guarantee even if it skipped
// validation. A claim citing a phantom or blank-draft id is not sourced.
export function isClaimSourced(claim: Claim, validSourceIds?: Set<string>): boolean {
  if (!SOURCING_CLASSES.has(claim.evidenceClass)) return false;
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
  const validSourceIds = new Set(ledger.sources.filter(isUsableSource).map((s) => s.id));

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
