import { describe, expect, it } from "vitest";
import { evidenceCellSupportsField } from "../../app/src/data/garpaEvidencePolicy";
import type { EvidenceCell } from "../../app/src/types/garpa";

const claimantCell: EvidenceCell = {
  id: "claimant_cell",
  target: "operator_need",
  venue: "claimant_publication",
  control: "claimant_controlled",
  locator: { artifactId: "artifact" },
  statement: "The claimant describes an operator need.",
  limitations: [],
};

describe("GARPA evidence policy", () => {
  it("does not let claimant prose establish an operator-owned requirement", () => {
    expect(evidenceCellSupportsField("named_operator_need", claimantCell)).toBe(false);
  });

  it("does not let claimant prose establish the economic comparator", () => {
    expect(
      evidenceCellSupportsField("economic_baseline", {
        ...claimantCell,
        target: "cost_observed",
        statement: "The claimant supplies its own comparator cost.",
      }),
    ).toBe(false);
  });

  it("still preserves claimant economics as an advertised claim", () => {
    expect(
      evidenceCellSupportsField("advertised_economics", {
        ...claimantCell,
        target: "claim_was_made",
        statement: "The claimant says the offering is cheaper.",
      }),
    ).toBe(true);
  });
});
