import { describe, expect, it } from "vitest";
import { GARPA_METHOD_VERSION } from "../../app/src/lib/garpa/garpaVersion";
import { IMPLEMENTED_GARPA_STAGES } from "../../app/src/lib/garpa/implementedStages";

describe("GARPA method version", () => {
  it("names the Commons-seeded external-publication receipt surface", () => {
    expect(GARPA_METHOD_VERSION).toBe(
      "1.7.0-commons-seeded-external-publication-receipt",
    );
    expect(
      IMPLEMENTED_GARPA_STAGES[IMPLEMENTED_GARPA_STAGES.length - 1],
    ).toBe("commons_seeded_external_publication_receipt");
    expect(IMPLEMENTED_GARPA_STAGES).toContain(
      "commons_seeded_public_registry",
    );
    expect(IMPLEMENTED_GARPA_STAGES).toContain(
      "commons_seeded_release_verification",
    );
  });
});
