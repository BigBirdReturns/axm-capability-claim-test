import { describe, it, expect } from "vitest";
import { validateLedger } from "../../app/src/lib/validateLedger";

const minimal = {
  schemaVersion: 1,
  objectType: "product_company",
  targetName: "Example Co",
  sources: [{ id: "s1", title: "Filing" }],
  claims: [
    {
      field: "capital_raised",
      statement: "Raised $10M.",
      evidenceClass: "confirmed",
      sourceIds: ["s1"],
    },
  ],
};

describe("validateLedger", () => {
  it("accepts a minimal valid ledger and assigns claim ids by index", () => {
    const r = validateLedger(minimal);
    expect(r.ok).toBe(true);
    expect(r.ledger?.claims[0]?.id).toBe("claim_0");
  });

  it("parses a JSON string", () => {
    const r = validateLedger(JSON.stringify(minimal));
    expect(r.ok).toBe(true);
  });

  it("reports invalid JSON loudly", () => {
    const r = validateLedger("{ not json");
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/Invalid JSON/);
  });

  it("rejects an unknown object type", () => {
    const r = validateLedger({ ...minimal, objectType: "spaceship" });
    expect(r.ok).toBe(false);
  });

  it("rejects an unknown evidence class", () => {
    const bad = { ...minimal, claims: [{ ...minimal.claims[0], evidenceClass: "rumor" }] };
    const r = validateLedger(bad);
    expect(r.ok).toBe(false);
  });

  it("rejects a claim that references an unknown source", () => {
    const bad = { ...minimal, claims: [{ ...minimal.claims[0], sourceIds: ["s9"] }] };
    const r = validateLedger(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/unknown source "s9"/);
  });

  it("requires a non-empty target name", () => {
    const r = validateLedger({ ...minimal, targetName: "" });
    expect(r.ok).toBe(false);
  });

  it("normalizes optional analysis annotations when present", () => {
    const r = validateLedger({
      ...minimal,
      contamination: { bucket: "clean", components: [] },
      verdictNotes: { state: "A_capability_with_proof", loop: "closed" },
    });
    expect(r.ok).toBe(true);
    expect(r.ledger?.contamination?.bucket).toBe("clean");
    expect(r.ledger?.verdictNotes?.state).toBe("A_capability_with_proof");
  });
});
