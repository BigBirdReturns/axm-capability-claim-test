import { describe, expect, it } from "vitest";
import { GARPA_METHOD_VERSION } from "../../app/src/lib/garpa/garpaVersion";

describe("GARPA method version", () => {
  it("names the execution-custody surface", () => {
    expect(GARPA_METHOD_VERSION).toBe("0.1.0-execution-custody");
  });
});
