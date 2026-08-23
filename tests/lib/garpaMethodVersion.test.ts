import { describe, expect, it } from "vitest";
import { GARPA_METHOD_VERSION } from "../../app/src/lib/garpa/garpaVersion";
import { IMPLEMENTED_GARPA_STAGES } from "../../app/src/lib/garpa/implementedStages";

describe("GARPA method version", () => {
  it("names the capability-commons surface", () => {
    expect(GARPA_METHOD_VERSION).toBe("0.2.0-capability-commons");
    expect(
      IMPLEMENTED_GARPA_STAGES[IMPLEMENTED_GARPA_STAGES.length - 1],
    ).toBe("capability_commons_catalog");
  });
});
