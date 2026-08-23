import { describe, expect, it } from "vitest";
import { GARPA_METHOD_VERSION } from "../../app/src/lib/garpa/garpaVersion";
import { IMPLEMENTED_GARPA_STAGES } from "../../app/src/lib/garpa/implementedStages";

describe("GARPA method version", () => {
  it("names the Commons-seeded build-manifest surface", () => {
    expect(GARPA_METHOD_VERSION).toBe(
      "0.8.0-commons-seeded-build-manifest",
    );
    expect(
      IMPLEMENTED_GARPA_STAGES[IMPLEMENTED_GARPA_STAGES.length - 1],
    ).toBe("commons_seeded_build_manifest");
    expect(IMPLEMENTED_GARPA_STAGES).toContain(
      "commons_seeded_qualification",
    );
  });
});
