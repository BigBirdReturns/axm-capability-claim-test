import { describe, expect, it } from "vitest";
import vectusPacketRaw from "../../examples/garpa-vectus/claim-packet.json";
import { runOfferingEvidenceGate } from "../../app/src/lib/garpa/runOfferingEvidenceGate";
import { validateClaimPacket } from "../../app/src/lib/garpa/validateClaimPacket";
import type { ClaimPacket } from "../../app/src/types/garpa";

function packet(): ClaimPacket {
  const result = validateClaimPacket(vectusPacketRaw);
  expect(result.ok, result.errors.join("; ")).toBe(true);
  return structuredClone(result.claimPacket!);
}

describe("GARPA offering evidence gate", () => {
  it("does not let subject metadata satisfy an evidence field", () => {
    const claimPacket = packet();
    claimPacket.subject.offeringVersion = "unsourced-version-label";

    const gate = runOfferingEvidenceGate(claimPacket);
    expect(gate.admittedFields).not.toContain("offering_version");
    expect(gate.missingFields).toContain("offering_version");
    expect(gate.architecturePreconditionsPassed).toBe(false);
  });
});
