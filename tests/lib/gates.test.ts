import { describe, it, expect } from "vitest";
import type { Ledger } from "../../app/src/types/audit";
import { runObjectGate } from "../../app/src/lib/runObjectGate";
import { runSourcingGate } from "../../app/src/lib/runSourcingGate";
import { runContaminationBucket } from "../../app/src/lib/runContaminationBucket";

function ledger(partial: Partial<Ledger>): Ledger {
  return {
    schemaVersion: 1,
    objectType: "product_company",
    targetName: "T",
    sources: [],
    claims: [],
    ...partial,
  };
}

describe("object gate", () => {
  it("routes a product company to operating proof", () => {
    const r = runObjectGate(ledger({ objectType: "product_company" }));
    expect(r.route).toBe("operating_proof_contamination");
  });

  it("routes a capital allocator to attribution proof", () => {
    const r = runObjectGate(ledger({ objectType: "capital_allocator" }));
    expect(r.route).toBe("attribution_proof_contamination");
  });
});

describe("sourcing gate", () => {
  const sourced = (field: string) => ({
    id: `c_${field}`,
    field,
    statement: "x",
    evidenceClass: "confirmed" as const,
    sourceIds: ["s1"],
  });

  it("counts a field sourced only when cited and not open", () => {
    const r = runSourcingGate(
      ledger({
        sources: [{ id: "s1", title: "src" }],
        claims: [
          sourced("capital_raised"),
          { id: "c1", field: "valuation", statement: "x", evidenceClass: "open", sourceIds: [] },
          { id: "c2", field: "named_customer", statement: "x", evidenceClass: "reported", sourceIds: [] },
        ],
      }),
    );
    expect(r.sourcedCount).toBe(1);
    expect(r.passed).toBe(false);
  });

  it("passes at three sourced load-bearing fields", () => {
    const r = runSourcingGate(
      ledger({
        sources: [{ id: "s1", title: "src" }],
        claims: [sourced("capital_raised"), sourced("valuation"), sourced("named_customer")],
      }),
    );
    expect(r.sourcedCount).toBe(3);
    expect(r.passed).toBe(true);
  });

  it("uses allocator fields for an allocator, not product fields", () => {
    const r = runSourcingGate(
      ledger({
        objectType: "capital_allocator",
        sources: [{ id: "s1", title: "src" }],
        claims: [sourced("fund_size")],
      }),
    );
    expect(r.fields.map((f) => f.field)).toContain("fund_size");
    expect(r.fields.map((f) => f.field)).not.toContain("capital_raised");
  });
});

describe("contamination bucket", () => {
  it("returns insufficient_data when nothing is source-backed", () => {
    const r = runContaminationBucket(ledger({}));
    expect(r.bucket).toBe("insufficient_data");
  });

  it("honors an explicit bucket from the ledger", () => {
    const r = runContaminationBucket(
      ledger({ contamination: { bucket: "circular", components: [] } }),
    );
    expect(r.bucket).toBe("circular");
  });

  it("marks a component present only when it has a reason and a source", () => {
    const r = runContaminationBucket(
      ledger({
        contamination: {
          components: [
            {
              key: "cap_table_circularity",
              present: true,
              reason: "Consortium supplies most capital.",
              sourceIds: ["s4"],
            },
            { key: "validator_circularity", present: true, reason: "", sourceIds: [] },
          ],
        },
      }),
    );
    const cap = r.components.find((c) => c.key === "cap_table_circularity");
    const val = r.components.find((c) => c.key === "validator_circularity");
    expect(cap?.present).toBe(true);
    expect(val?.present).toBe(false);
  });

  it("never exposes a numeric score on the public component reason", () => {
    const r = runContaminationBucket(ledger({}));
    for (const c of r.components) {
      expect(c.reason).not.toMatch(/^\d+$/);
    }
  });
});
