import { describe, expect, it } from "vitest";
import { GARPA_METHOD_VERSION } from "../../app/src/lib/garpa/garpaVersion";
import { IMPLEMENTED_GARPA_STAGES } from "../../app/src/lib/garpa/implementedStages";

describe("GARPA method version", () => {
  it("names the Commons-seeded mission-evaluation surface", () => {
    expect(GARPA_METHOD_VERSION).toBe(
      "1.2.0-commons-seeded-mission-evaluation",
    );
    expect(
      IMPLEMENTED_GARPA_STAGES[IMPLEMENTED_GARPA_STAGES.length - 1],
    ).toBe("commons_seeded_mission_evaluation");
    expect(IMPLEMENTED_GARPA_STAGES).toContain("commons_seeded_test_run");
    expect(IMPLEMENTED_GARPA_STAGES).toContain("commons_seeded_preflight");
  });
});
