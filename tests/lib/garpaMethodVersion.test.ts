import { describe, expect, it } from "vitest";
import { GARPA_METHOD_VERSION } from "../../app/src/lib/garpa/garpaVersion";
import { IMPLEMENTED_GARPA_STAGES } from "../../app/src/lib/garpa/implementedStages";

describe("GARPA method version", () => {
  it("names the Commons component-projection surface", () => {
    expect(GARPA_METHOD_VERSION).toBe("0.4.0-commons-component-projection");
    expect(
      IMPLEMENTED_GARPA_STAGES[IMPLEMENTED_GARPA_STAGES.length - 1],
    ).toBe("commons_component_projection");
    expect(IMPLEMENTED_GARPA_STAGES).toContain("commons_retrieval_plan");
    expect(IMPLEMENTED_GARPA_STAGES).toContain("commons_case_nomination");
  });
});
