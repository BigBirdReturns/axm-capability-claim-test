import { describe, expect, it } from "vitest";
import { GARPA_METHOD_VERSION } from "../../app/src/lib/garpa/garpaVersion";
import { IMPLEMENTED_GARPA_STAGES } from "../../app/src/lib/garpa/implementedStages";

describe("GARPA method version", () => {
  it("names the Commons-seeded substitution surface", () => {
    expect(GARPA_METHOD_VERSION).toBe("0.5.0-commons-seeded-substitution");
    expect(
      IMPLEMENTED_GARPA_STAGES[IMPLEMENTED_GARPA_STAGES.length - 1],
    ).toBe("commons_seeded_substitution");
    expect(IMPLEMENTED_GARPA_STAGES).toContain("commons_component_projection");
  });
});
