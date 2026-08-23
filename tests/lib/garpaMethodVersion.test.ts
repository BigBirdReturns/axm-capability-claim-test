import { describe, expect, it } from "vitest";
import { GARPA_METHOD_VERSION } from "../../app/src/lib/garpa/garpaVersion";
import { IMPLEMENTED_GARPA_STAGES } from "../../app/src/lib/garpa/implementedStages";

describe("GARPA method version", () => {
  it("names the commons case-transfer surface", () => {
    expect(GARPA_METHOD_VERSION).toBe("0.3.0-commons-case-transfer");
    expect(
      IMPLEMENTED_GARPA_STAGES[IMPLEMENTED_GARPA_STAGES.length - 1],
    ).toBe("commons_case_nomination");
    expect(IMPLEMENTED_GARPA_STAGES).toContain("commons_retrieval_plan");
  });
});
