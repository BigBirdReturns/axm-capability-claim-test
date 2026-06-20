import { describe, it, expect } from "vitest";
import { validateLedger } from "../../app/src/lib/validateLedger";
import { buildReport } from "../../app/src/lib/renderReport";
import cleared from "../../examples/cleared-capability/ledger.json";
import circular from "../../examples/circular-unproven/ledger.json";
import insufficient from "../../examples/insufficient-ledger/ledger.json";
import allocator from "../../examples/capital-allocator-insufficient/ledger.json";

function report(raw: unknown) {
  const v = validateLedger(raw);
  expect(v.ok, v.errors.join("; ")).toBe(true);
  return buildReport(v.ledger!);
}

// The regression principle: prove the instrument can ACQUIT, CLASSIFY, and
// REFUSE TO VERDICT. These examples are the locks.

describe("example regression suite", () => {
  it("acquits the cleared capability (A / Clean)", () => {
    const r = report(cleared);
    expect(r.sourcingGate.passed).toBe(true);
    expect(r.verdict?.state).toBe("A_capability_with_proof");
    expect(r.contamination?.bucket).toBe("clean");
  });

  it("classifies the circular/unproven company (C / Circular)", () => {
    const r = report(circular);
    expect(r.sourcingGate.passed).toBe(true);
    expect(r.verdict?.state).toBe("C_costume_or_proof_substitution");
    expect(r.contamination?.bucket).toBe("circular");
  });

  it("refuses to verdict on the insufficient ledger", () => {
    const r = report(insufficient);
    expect(r.sourcingGate.passed).toBe(false);
    expect(r.verdict).toBeUndefined();
    expect(r.seams).toBeUndefined();
    expect((r.pullList ?? []).length).toBeGreaterThan(0);
  });

  it("routes the allocator to attribution and refuses to verdict", () => {
    const r = report(allocator);
    expect(r.objectGate.route).toBe("attribution_proof_contamination");
    // Attribution fields, not product seams.
    expect(r.sourcingGate.fields.map((f) => f.field)).toContain("attributable_wins");
    expect(r.sourcingGate.fields.map((f) => f.field)).not.toContain("competed_awards");
    expect(r.sourcingGate.passed).toBe(false);
    expect(r.verdict).toBeUndefined();
  });
});
