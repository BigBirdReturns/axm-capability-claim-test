import { describe, expect, it } from "vitest";
import { GARPA_METHOD_VERSION } from "../../app/src/lib/garpa/garpaVersion";
import { IMPLEMENTED_GARPA_STAGES } from "../../app/src/lib/garpa/implementedStages";

describe("GARPA method version", () => {
  it("names the Commons-seeded test-run surface", () => {
    expect(GARPA_METHOD_VERSION).toBe("1.1.0-commons-seeded-test-run");
    expect(IMPLEMENTED_GARPA_STAGES.at(-1)).toBe("commons_seeded_test_run");
    expect(IMPLEMENTED_GARPA_STAGES).toContain("commons_seeded_preflight");
    expect(IMPLEMENTED_GARPA_STAGES).toContain("commons_seeded_build_receipt");
  });
});
