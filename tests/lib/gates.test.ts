import { describe, it, expect } from "vitest";
import type { Ledger } from "../../app/src/types/audit";
import { runObjectGate } from "../../app/src/lib/runObjectGate";
import { runSourcingGate } from "../../app/src/lib/runSourcingGate";
import { runContaminationBucket } from "../../app/src/lib/runContaminationBucket";
import { runSeams, weakSignalCount } from "../../app/src/lib/runSeams";
import type { SeamResult } from "../../app/src/types/audit";
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

  // Doctrine: "judgment" is the analyst's own interpretive call, not external
  // evidence. A cited judgment claim is NOT sourced and three of them cannot
  // unlock a verdict — otherwise the gate is freehand-able.
  it("does not count a cited judgment claim toward the threshold", () => {
    const r = runSourcingGate(
      ledger({
        sources: [{ id: "s1", title: "src" }],
        claims: [
          { id: "j1", field: "capital_raised", statement: "x", evidenceClass: "judgment", sourceIds: ["s1"] },
          { id: "j2", field: "valuation", statement: "x", evidenceClass: "judgment", sourceIds: ["s1"] },
          { id: "j3", field: "named_customer", statement: "x", evidenceClass: "judgment", sourceIds: ["s1"] },
        ],
      }),
    );
    expect(r.sourcedCount).toBe(0);
    expect(r.passed).toBe(false);
  });

  // The external classes (confirmed / reported / derived) still count.
  it("counts confirmed, reported, and derived claims toward the threshold", () => {
    const r = runSourcingGate(
      ledger({
        sources: [{ id: "s1", title: "src" }],
        claims: [
          { id: "a", field: "capital_raised", statement: "x", evidenceClass: "confirmed", sourceIds: ["s1"] },
          { id: "b", field: "valuation", statement: "x", evidenceClass: "reported", sourceIds: ["s1"] },
          { id: "c", field: "named_customer", statement: "x", evidenceClass: "derived", sourceIds: ["s1"] },
        ],
      }),
    );
    expect(r.sourcedCount).toBe(3);
    expect(r.passed).toBe(true);
  });

  // The allowlist must fail closed: an unknown / misspelled evidence class
  // arriving from a door that skipped validateLedger must NOT count, even with a
  // real source. (Cast through unknown because the type system forbids the typo.)
  it("does not count an unknown evidence class even with a real source", () => {
    const r = runSourcingGate(
      ledger({
        sources: [{ id: "s1", title: "src" }],
        claims: [
          { id: "a", field: "capital_raised", statement: "x", evidenceClass: "confimed" as unknown as "confirmed", sourceIds: ["s1"] },
          { id: "b", field: "valuation", statement: "x", evidenceClass: "totally_made_up" as unknown as "confirmed", sourceIds: ["s1"] },
          { id: "c", field: "named_customer", statement: "x", evidenceClass: "reported", sourceIds: ["s1"] },
        ],
      }),
    );
    expect(r.sourcedCount).toBe(1);
    expect(r.passed).toBe(false);
  });

  // A blank draft source (no details) does not resolve, so a claim citing only
  // it is not sourced. Editing in a title flips it to sourced.
  it("does not count a claim whose only source is a blank draft", () => {
    const blank = runSourcingGate(
      ledger({
        sources: [{ id: "u1", title: "" }],
        claims: [
          { id: "a", field: "capital_raised", statement: "x", evidenceClass: "confirmed", sourceIds: ["u1"] },
        ],
      }),
    );
    expect(blank.sourcedCount).toBe(0);

    const filled = runSourcingGate(
      ledger({
        sources: [{ id: "u1", title: "A real title" }],
        claims: [
          { id: "a", field: "capital_raised", statement: "x", evidenceClass: "confirmed", sourceIds: ["u1"] },
        ],
      }),
    );
    expect(filled.sourcedCount).toBe(1);
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

  // §8.1 duplicate-claim airtightness: multiple claims on ONE load-bearing
  // field cannot inflate the sourced count past 1. You cannot reach the
  // threshold of three by stuffing three sourced claims onto a single field.
  it("counts a field at most once no matter how many claims target it", () => {
    const r = runSourcingGate(
      ledger({
        sources: [{ id: "s1", title: "src" }],
        claims: [
          sourced("capital_raised"),
          { ...sourced("capital_raised"), id: "dup1" },
          { ...sourced("capital_raised"), id: "dup2" },
        ],
      }),
    );
    expect(r.sourcedCount).toBe(1);
    expect(r.passed).toBe(false);
  });

  // §8.1 duplicate-claim airtightness: a field is sourced if ANY of its claims
  // is sourced, regardless of order — an unsourced claim listed first does not
  // mask a sourced sibling.
  it("treats a field as sourced when any claim is sourced, order-independent", () => {
    const base = {
      sources: [{ id: "s1", title: "src" }],
      claims: [
        { id: "open1", field: "capital_raised", statement: "x", evidenceClass: "open" as const, sourceIds: [] },
        sourced("capital_raised"),
      ],
    };
    const forward = runSourcingGate(ledger(base));
    const reversed = runSourcingGate(
      ledger({ ...base, claims: [...base.claims].reverse() }),
    );
    expect(forward.sourcedCount).toBe(1);
    expect(reversed.sourcedCount).toBe(1);
    // The reported evidence class is the sourced claim's, not the open one's.
    expect(forward.fields.find((f) => f.field === "capital_raised")?.evidenceClass).toBe("confirmed");
    expect(reversed.fields.find((f) => f.field === "capital_raised")?.evidenceClass).toBe("confirmed");
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

  // §8.1 explicit-vs-derived disagreement: an author cannot launder sourced
  // contamination into a clean reading. A "clean" bucket asserted over a
  // source-backed component that derives circular yields the HARDER bucket.
  it("does not let an explicit clean bucket override source-backed circular", () => {
    const r = runContaminationBucket(
      ledger({
        contamination: {
          bucket: "clean",
          components: [
            {
              key: "cap_table_circularity",
              present: true,
              reason: "Consortium supplies most capital.",
              sourceIds: ["s4"],
              internalScore: 100,
            },
          ],
        },
      }),
    );
    expect(r.bucket).toBe("circular");
  });

  // §8.1: the same guard applies to an under-call of "mixed" over circular.
  it("does not let an explicit mixed bucket soften source-backed circular", () => {
    const r = runContaminationBucket(
      ledger({
        contamination: {
          bucket: "mixed",
          components: [
            {
              key: "cap_table_circularity",
              present: true,
              reason: "Consortium supplies most capital.",
              sourceIds: ["s4"],
              internalScore: 100,
            },
          ],
        },
      }),
    );
    expect(r.bucket).toBe("circular");
  });

  // §8.1: the guard is one-directional. An explicit bucket HARDER than the
  // derived one is honored — an author may read contamination more severely
  // than the average score, provided the assertion is itself source-backed.
  it("honors an explicit circular bucket harder than the derived score", () => {
    const r = runContaminationBucket(
      ledger({
        contamination: {
          bucket: "circular",
          components: [
            {
              key: "cap_table_circularity",
              present: true,
              reason: "One thin circular tie.",
              sourceIds: ["s4"],
              internalScore: 10, // derives "clean" on its own
            },
          ],
        },
      }),
    );
    expect(r.bucket).toBe("circular");
  });

  // §8.1: an explicit clean bucket with NO source-backed component is honored
  // (the cleared-capability example shape) — clean is not an assertion of
  // contamination, and there is no contradicting evidence to answer to.
  it("honors an explicit clean bucket when no component is source-backed", () => {
    const r = runContaminationBucket(
      ledger({
        contamination: {
          bucket: "clean",
          components: [
            { key: "validator_circularity", present: false, reason: "Independent test range.", sourceIds: ["s2"] },
          ],
        },
      }),
    );
    expect(r.bucket).toBe("clean");
  });
});

describe("seam accounting", () => {
  const seam = (state: SeamResult["state"]): SeamResult => ({
    id: "x",
    question: "q",
    state,
    reason: "r",
    sourceIds: [],
  });

  // §8.1 not_applicable accounting: only triggered seams are weak signal.
  // not_applicable, unclear, and not_triggered never contribute — this is the
  // contract any future weighting must not breach.
  it("counts only triggered seams as weak signal", () => {
    const seams = [
      seam("triggered"),
      seam("not_applicable"),
      seam("unclear"),
      seam("not_triggered"),
    ];
    expect(weakSignalCount(seams)).toBe(1);
  });

  it("never counts not_applicable, even in bulk", () => {
    const seams = Array.from({ length: 5 }, () => seam("not_applicable"));
    expect(weakSignalCount(seams)).toBe(0);
  });

  // Un-annotated seams default to unclear (an open question), not a signal.
  it("defaults un-annotated seams to unclear and counts no weak signal", () => {
    const seams = runSeams(ledger({}));
    expect(seams.every((s) => s.state === "unclear")).toBe(true);
    expect(weakSignalCount(seams)).toBe(0);
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
