import { describe, expect, it } from "vitest";
import { GARPA_METHOD_VERSION } from "../../app/src/lib/garpa/garpaVersion";
import { IMPLEMENTED_GARPA_STAGES } from "../../app/src/lib/garpa/implementedStages";

describe("GARPA method version", () => {
  it("names the Commons-seeded release-verification surface", () => {
    expect(GARPA_METHOD_VERSION).toBe(
      "1.5.0-commons-seeded-release-verification",
    );
    expect(
      IMPLEMENTED_GARPA_STAGES[IMPLEMENTED_GARPA_STAGES.length - 1],
    ).toBe("commons_seeded_release_verification");
    expect(IMPLEMENTED_GARPA_STAGES).toContain(
      "commons_seeded_publication",
    );
    expect(IMPLEMENTED_GARPA_STAGES).toContain(
      "commons_seeded_vendor_parity",
    );
  });
});
