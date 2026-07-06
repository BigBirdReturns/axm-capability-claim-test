import { describe, it, expect } from "vitest";
import type { Ledger } from "../../app/src/types/audit";
import { runReplicationPlan, isPricingStrategy } from "../../app/src/lib/runReplicationPlan";
import { buildReport } from "../../app/src/lib/renderReport";
import {
  REPLICATION_STRATEGIES,
  type ReplicationStrategyDef,
} from "../../app/src/data/replicationStrategies";
import { FRONTIER_LOAD_BEARING } from "../../app/src/data/loadBearingFields";

function frontierLedger(overrides: Partial<Ledger> = {}): Ledger {
  return {
    schemaVersion: 1,
    objectType: "frontier_model",
    targetName: "Test Frontier Model",
    sources: [
      { id: "s1", title: "Independent harness run", url: "https://example.org/h" },
      { id: "s2", title: "External replication", url: "https://example.org/r" },
      { id: "s3", title: "University benchmark", url: "https://example.org/u" },
    ],
    claims: [
      { id: "c1", field: "benchmark_delta", statement: "+10 vs named baseline.", evidenceClass: "confirmed", sourceIds: ["s1"] },
      { id: "c2", field: "context_capacity", statement: "1M usable context.", evidenceClass: "confirmed", sourceIds: ["s2"] },
      { id: "c3", field: "long_horizon_agency", statement: "71% on 4h tasks.", evidenceClass: "reported", sourceIds: ["s3"] },
      { id: "c4", field: "multimodal_range", statement: "Best in class, per launch post.", evidenceClass: "open", sourceIds: [] },
      { id: "c5", field: "novel_synthesis", statement: "Unmatched synthesis in small-n study.", evidenceClass: "reported", sourceIds: ["s3"] },
    ],
    ...overrides,
  };
}

describe("replication catalog invariants", () => {
  it("every strategy carries a non-empty residual — no residual, not finished", () => {
    for (const s of REPLICATION_STRATEGIES) {
      expect(s.residual.trim().length, s.key).toBeGreaterThan(0);
    }
  });

  it("every strategy axis is a real frontier load-bearing field", () => {
    const known = new Set(FRONTIER_LOAD_BEARING.map((f) => f.field));
    for (const s of REPLICATION_STRATEGIES) {
      for (const axis of s.axes) {
        expect(known.has(axis), `${s.key} -> ${axis}`).toBe(true);
      }
    }
  });

  it("pricing maturity is an allowlist: unknown maturity fails closed", () => {
    const bogus = {
      ...REPLICATION_STRATEGIES[0],
      maturity: "establihsed",
    } as unknown as ReplicationStrategyDef;
    expect(isPricingStrategy(bogus)).toBe(false);
    expect(isPricingStrategy({ ...bogus, maturity: "experimental" } as ReplicationStrategyDef)).toBe(false);
  });
});

describe("runReplicationPlan", () => {
  it("prices a sourced delta and carries the strategies' residuals verbatim", () => {
    const plan = runReplicationPlan(frontierLedger());
    const bench = plan.axes.find((a) => a.field === "benchmark_delta")!;
    expect(bench.status).toBe("priced");
    expect(bench.deltaSourced).toBe(true);
    expect(bench.evidenceClass).toBe("confirmed");
    expect(bench.strategies.length).toBeGreaterThan(0);
    expect(bench.residuals.length).toBeGreaterThan(0);
    for (const s of bench.strategies.filter((m) => m.maturity !== "experimental")) {
      expect(bench.residuals).toContain(s.residual);
    }
  });

  it("refuses to price an unsourced delta — no strategies, even when the catalog covers the axis", () => {
    const plan = runReplicationPlan(frontierLedger());
    const mm = plan.axes.find((a) => a.field === "multimodal_range")!;
    expect(mm.status).toBe("unpriced_delta");
    expect(mm.strategies).toEqual([]);
    expect(plan.unpricedAxes).toContain("Multimodal range");
  });

  it("judgment never prices an axis, even with a cited source", () => {
    const ledger = frontierLedger();
    ledger.claims.push({
      id: "c6",
      field: "cost_latency_profile",
      statement: "Analyst read on routing economics.",
      evidenceClass: "judgment",
      sourceIds: ["s1"],
    });
    const plan = runReplicationPlan(ledger);
    const cost = plan.axes.find((a) => a.field === "cost_latency_profile")!;
    expect(cost.status).toBe("unpriced_delta");
  });

  it("a sourced axis with only experimental coverage is the frontier residual, with leads flagged", () => {
    const plan = runReplicationPlan(frontierLedger());
    const synth = plan.axes.find((a) => a.field === "novel_synthesis")!;
    expect(synth.status).toBe("frontier_residual");
    expect(synth.deltaSourced).toBe(true);
    // Experimental leads are visible but do not price.
    for (const s of synth.strategies) expect(s.maturity).toBe("experimental");
    expect(plan.residualAxes).toContain("Novel synthesis");
  });

  it("a phantom or blank-draft source cannot price an axis", () => {
    const ledger = frontierLedger({
      sources: [{ id: "s1", title: "" }],
      claims: [
        { id: "c1", field: "benchmark_delta", statement: "+10.", evidenceClass: "confirmed", sourceIds: ["s1"] },
        { id: "c2", field: "context_capacity", statement: "1M.", evidenceClass: "confirmed", sourceIds: ["ghost"] },
      ],
    });
    const plan = runReplicationPlan(ledger);
    expect(plan.axes.find((a) => a.field === "benchmark_delta")!.status).toBe("unpriced_delta");
    expect(plan.axes.find((a) => a.field === "context_capacity")!.status).toBe("unpriced_delta");
  });

  it("always states the plan-level falsification line and doctrine", () => {
    const plan = runReplicationPlan(frontierLedger());
    expect(plan.falsificationLine.length).toBeGreaterThan(0);
    expect(plan.doctrine).toMatch(/prices only sourced deltas/i);
  });
});

describe("replication plan behind the gates", () => {
  it("buildReport attaches the plan for frontier_model when the gate passes", () => {
    const report = buildReport(frontierLedger());
    expect(report.sourcingGate.passed).toBe(true);
    expect(report.replicationPlan).toBeDefined();
    expect(report.replicationPlan!.pricedCount).toBeGreaterThan(0);
  });

  it("below the sourcing threshold there is no plan — pull-list only, by design", () => {
    const ledger = frontierLedger({
      claims: [
        { id: "c1", field: "benchmark_delta", statement: "+10.", evidenceClass: "confirmed", sourceIds: ["s1"] },
      ],
    });
    const report = buildReport(ledger);
    expect(report.sourcingGate.passed).toBe(false);
    expect(report.replicationPlan).toBeUndefined();
    expect((report.pullList ?? []).length).toBeGreaterThan(0);
  });

  it("non-frontier objects never get a replication plan", () => {
    const ledger = frontierLedger({ objectType: "product_company" });
    const report = buildReport(ledger);
    expect(report.replicationPlan).toBeUndefined();
  });
});
