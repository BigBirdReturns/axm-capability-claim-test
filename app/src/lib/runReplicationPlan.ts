import type {
  AxisReplication,
  Ledger,
  ReplicationPlan,
  ReplicationStrategyMatch,
  StrategyMaturity,
} from "../types/audit";
import { fieldsForSet } from "../data/loadBearingFields";
import {
  REPLICATION_STRATEGIES,
  type ReplicationStrategyDef,
} from "../data/replicationStrategies";
import { isClaimSourced, isUsableSource } from "./runSourcingGate";

// Maturities that may PRICE an axis. An allowlist, on purpose — it mirrors
// SOURCING_CLASSES in runSourcingGate: only externally-anchored maturities
// (established engineering practice, or independently reported results) can
// turn a sourced delta into a recipe. "experimental" — and any unknown or
// misspelled maturity arriving from a future catalog edit — fails closed and
// is carried as a lead, never as a price.
const PRICING_MATURITIES: ReadonlySet<StrategyMaturity> = new Set<StrategyMaturity>([
  "established",
  "reported",
]);

export function isPricingStrategy(def: ReplicationStrategyDef): boolean {
  return PRICING_MATURITIES.has(def.maturity);
}

function toMatch(def: ReplicationStrategyDef): ReplicationStrategyMatch {
  return {
    key: def.key,
    label: def.label,
    maturity: def.maturity,
    composition: def.composition,
    components: def.components,
    residual: def.residual,
    costNote: def.costNote,
  };
}

// The replication plan — the second half of the frontier route. Doctrine:
// THE PLAN PRICES ONLY SOURCED DELTAS. An axis whose delta was never sourced
// gets no recipe — pricing an unsourced launch claim would launder marketing
// into an engineering roadmap. Sourced axes are priced from the catalog with
// their residuals carried verbatim; sourced axes no pricing-grade strategy
// covers are named as the frontier residual — the honest ceiling.
export function runReplicationPlan(ledger: Ledger): ReplicationPlan {
  const fields = fieldsForSet("frontier");
  const validSourceIds = new Set(ledger.sources.filter(isUsableSource).map((s) => s.id));

  const axes: AxisReplication[] = fields.map((f) => {
    const claimsForField = ledger.claims.filter((c) => c.field === f.field);
    const sourcedClaim = claimsForField.find((c) => isClaimSourced(c, validSourceIds));
    const matched = REPLICATION_STRATEGIES.filter((s) => s.axes.includes(f.field));
    const pricing = matched.filter(isPricingStrategy);
    const leads = matched.filter((s) => !isPricingStrategy(s));

    if (!sourcedClaim) {
      // Refused, not priced. Strategies are withheld even when the catalog
      // covers the axis — a recipe would read as endorsement of the delta.
      return {
        field: f.field,
        label: f.label,
        deltaSourced: false,
        status: "unpriced_delta" as const,
        strategies: [],
        residuals: [],
        note: `Delta not sourced. The plan refuses to price a marketing claim — source ${f.label.toLowerCase()} first.`,
      };
    }

    if (pricing.length === 0) {
      return {
        field: f.field,
        label: f.label,
        deltaSourced: true,
        evidenceClass: sourcedClaim.evidenceClass,
        status: "frontier_residual" as const,
        // Experimental leads are shown, flagged by their maturity — visible,
        // but they do not move the axis out of the residual.
        strategies: leads.map(toMatch),
        residuals: [
          `No established or independently reported composition covers ${f.label.toLowerCase()}. This axis stays frontier.`,
        ],
        note: `Sourced delta with no pricing-grade replication. ${f.label} is part of the honest ceiling.`,
      };
    }

    return {
      field: f.field,
      label: f.label,
      deltaSourced: true,
      evidenceClass: sourcedClaim.evidenceClass,
      status: "priced" as const,
      strategies: [...pricing.map(toMatch), ...leads.map(toMatch)],
      residuals: pricing.map((s) => s.residual),
      note: `Sourced delta priced by ${pricing.map((s) => s.label).join(", ")} — residuals carried below.`,
    };
  });

  const priced = axes.filter((a) => a.status === "priced");
  const residual = axes.filter((a) => a.status === "frontier_residual");
  const unpriced = axes.filter((a) => a.status === "unpriced_delta");

  return {
    target: ledger.targetName,
    axes,
    pricedCount: priced.length,
    residualAxes: residual.map((a) => a.label),
    unpricedAxes: unpriced.map((a) => a.label),
    falsificationLine:
      "Run each priced composition against the same benchmark the delta was sourced on, with harness parity. Where the composition matches the frontier score, the delta is priced; where it does not, the residual stands.",
    doctrine:
      "The plan prices only sourced deltas. Unsourced axes are refused, not priced; sourced axes with no pricing-grade composition are named as the frontier residual.",
  };
}
