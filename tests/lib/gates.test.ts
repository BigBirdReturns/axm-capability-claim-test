import { describe, it, expect } from "vitest";
import type { Ledger } from "../../app/src/types/audit";
import { runObjectGate } from "../../app/src/lib/runObjectGate";
import { runSourcingGate } from "../../app/src/lib/runSourcingGate";
import { runContaminationBucket } from "../../app/src/lib/runContaminationBucket";
import { buildReport } from "../../app/src/lib/renderReport";

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

  it("counts a field sourced only when cited and externally evidenced", () => {
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

  it("counts confirmed, reported, and derived claims as external sourced evidence", () => {
    const r = runSourcingGate(
      ledger({
        sources: [{ id: "s1", title: "src" }],
        claims: [
          { ...sourced("capital_raised"), evidenceClass: "confirmed" },
          { ...sourced("valuation"), evidenceClass: "reported" },
          { ...sourced("named_customer"), evidenceClass: "derived" },
        ],
      }),
    );
    expect(r.sourcedCount).toBe(3);
    expect(r.passed).toBe(true);
  });

  it("does not let judgment-class claims unlock the verdict", () => {
    const r = runSourcingGate(
      ledger({
        sources: [{ id: "s1", title: "src" }],
        claims: ["capital_raised", "valuation", "named_customer"].map((field) => ({
          ...sourced(field),
          evidenceClass: "judgment" as const,
        })),
      }),
    );
    expect(r.sourcedCount).toBe(0);
    expect(r.passed).toBe(false);
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

  // Seam 4 regression: a claim citing a phantom source id (not present in
  // ledger.sources) is NOT sourced, even if validateLedger was skipped.
  it("does not count a claim citing an unresolved source id", () => {
    const r = runSourcingGate(
      ledger({
        sources: [{ id: "s1", title: "src" }],
        claims: [
          {
            id: "c1",
            field: "capital_raised",
            statement: "x",
            evidenceClass: "confirmed",
            sourceIds: ["ghost"],
          },
        ],
      }),
    );
    expect(r.sourcedCount).toBe(0);
  });

  it("does not count a claim citing a blank draft source", () => {
    const r = runSourcingGate(
      ledger({
        sources: [{ id: "s1", title: "" }],
        claims: [sourced("capital_raised")],
      }),
    );
    expect(r.sourcedCount).toBe(0);
  });
});

describe("contamination bucket", () => {
  it("returns insufficient_data when nothing is source-backed", () => {
    const r = runContaminationBucket(ledger({}));
    expect(r.bucket).toBe("insufficient_data");
  });

  it("honors an explicit bucket backed by a sourced component", () => {
    const r = runContaminationBucket(
      ledger({
        contamination: {
          bucket: "circular",
          components: [
            {
              key: "cap_table_circularity",
              present: true,
              reason: "Consortium supplies most capital.",
              sourceIds: ["s4"],
            },
          ],
        },
      }),
    );
    expect(r.bucket).toBe("circular");
  });

  // Bug 2 regression: an explicit asserting bucket with no source-backed
  // component is a bare number wearing a bucket's clothes. Downgrade it.
  it("downgrades an explicit circular bucket with no sourced components", () => {
    const r = runContaminationBucket(
      ledger({ contamination: { bucket: "circular", components: [] } }),
    );
    expect(r.bucket).toBe("insufficient_data");
  });

  // Bug 1 regression: a present component with no reason/source must score 0
  // and must not move the derived bucket off insufficient_data.
  it("does not let unsourced 'present' components move the bucket", () => {
    const r = runContaminationBucket(
      ledger({
        contamination: {
          components: [
            { key: "cap_table_circularity", present: true, reason: "", sourceIds: [] },
            { key: "validator_circularity", present: true, reason: "", sourceIds: [] },
          ],
        },
      }),
    );
    expect(r.bucket).toBe("insufficient_data");
  });

  // Bug 1 regression: a raw author internalScore with no source backing is
  // ignored; it cannot manufacture a bucket.
  it("ignores an author internalScore on an unsourced component", () => {
    const r = runContaminationBucket(
      ledger({
        contamination: {
          components: [
            { key: "cap_table_circularity", present: false, reason: "", sourceIds: [], internalScore: 100 },
          ],
        },
      }),
    );
    expect(r.bucket).toBe("insufficient_data");
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

describe("verdict supply state", () => {
  const passing = (extra: Partial<Ledger>) =>
    ledger({
      sources: [{ id: "s1", title: "src" }],
      claims: ["capital_raised", "valuation", "named_customer"].map((field) => ({
        id: `c_${field}`,
        field,
        statement: "x",
        evidenceClass: "confirmed" as const,
        sourceIds: ["s1"],
      })),
      ...extra,
    });

  // Epistemic 3 regression: gate passes but the analysis layer was never filled
  // in => not_supplied, NOT unclassifiable.
  it("returns not_supplied when the gate passes but verdictNotes is absent", () => {
    const r = buildReport(passing({}));
    expect(r.sourcingGate.passed).toBe(true);
    expect(r.verdict?.state).toBe("not_supplied");
  });

  it("returns unclassifiable when verdictNotes exists but states no verdict", () => {
    const r = buildReport(passing({ verdictNotes: { loop: "open" } }));
    expect(r.verdict?.state).toBe("unclassifiable");
  });
});
