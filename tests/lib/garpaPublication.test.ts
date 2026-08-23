import { describe, expect, it } from "vitest";
import evaluationRaw from "../../examples/garpa-synthetic-observation/mission-evaluation.json";
import publicationRaw from "../../examples/garpa-synthetic-observation/publication-package.json";
import type { MissionEvaluation } from "../../app/src/types/garpaEvaluation";
import type {
  PublicationClaim,
  PublicationPackage,
} from "../../app/src/types/garpaPublication";
import { compileMissionPublicationClaim } from "../../app/src/lib/garpa/compileMissionPublicationClaim";
import { validatePublicationPackage } from "../../app/src/lib/garpa/validatePublicationPackage";
import { runPublicationGate } from "../../app/src/lib/garpa/runPublicationGate";

const expectedDigests = {
  missionEvaluation: "evaluation:synthetic-observation:v1",
  build: "build:synthetic-observation:v1",
  qualification: "qualification:synthetic-observation:v1",
};

function validPublication(): PublicationPackage {
  const result = validatePublicationPackage(publicationRaw);
  expect(result.ok, result.errors.join("; ")).toBe(true);
  return result.value!;
}

function parityClaim(): PublicationClaim {
  return {
    id: "vendor-parity",
    caseId: "GARPA-SYNTH-OBS-001",
    text: "The GARPA build matches the vendor offering.",
    claimClass: "vendor_parity",
    subject: "Synthetic observation build",
    scope: {
      buildDigest: "build:synthetic-observation:v1",
      scenarioIds: ["scenario-controlled-entry"],
      metricIds: ["metric-detect-before-boundary"],
    },
    supportRefs: [
      {
        relation: "evaluated_by",
        evaluationDigest: "evaluation:synthetic-observation:v1",
        note: "Synthetic hostile fixture.",
      },
    ],
    limitations: [],
    prohibitedGeneralizations: [],
    state: "supported",
  };
}

describe("GARPA mission publication compiler", () => {
  it("compiles bounded_match into scoped language with prohibited generalizations", () => {
    const claim = compileMissionPublicationClaim({
      subject: "Synthetic observation build",
      evaluationDigest: "evaluation:synthetic-observation:v1",
      evaluation: evaluationRaw as MissionEvaluation,
      scenarioIds: ["scenario-controlled-entry"],
      metricIds: ["metric-detect-before-boundary"],
    });
    expect(claim.text).toContain("bounded mission slice");
    expect(claim.scope.buildDigest).toBe("build:synthetic-observation:v1");
    expect(claim.prohibitedGeneralizations).toContain(
      "Does not establish vendor-system parity.",
    );
  });
});

describe("GARPA publication package validation", () => {
  it("accepts the source-bound synthetic publication package", () => {
    const result = validatePublicationPackage(publicationRaw);
    expect(result.ok, result.errors.join("; ")).toBe(true);
  });

  it("rejects redactions that reference absent claims", () => {
    const publication = validPublication();
    publication.redactions.push({
      id: "redaction-1",
      claimId: "ghost-claim",
      reason: "other",
      removedContentDescription: "Synthetic hostile fixture.",
      evidentiaryEffect: "none",
      decidedBy: "reviewer",
      decidedAt: "2026-08-23T06:20:00Z",
    });
    const result = validatePublicationPackage(publication);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("unknown claim");
  });
});

describe("GARPA publication gate", () => {
  it("admits a bounded mission claim with current digests and completed reviews", () => {
    const result = runPublicationGate(validPublication(), expectedDigests);
    expect(result.passed).toBe(true);
    expect(result.state).toBe("publication_ready");
    expect(result.admittedClaimIds).toEqual(["mission-evaluation"]);
  });

  it("blocks stale upstream receipts", () => {
    const publication = validPublication();
    publication.upstreamDigests.build = "build:stale";
    const result = runPublicationGate(publication, expectedDigests);
    expect(result.passed).toBe(false);
    expect(result.state).toBe("upstream_receipt_stale");
  });

  it("blocks vendor-parity language without a same-fixture match", () => {
    const publication = validPublication();
    publication.claims.push(parityClaim());
    const result = runPublicationGate(publication, expectedDigests);
    expect(result.passed).toBe(false);
    expect(result.blockedClaimIds).toContain("vendor-parity");
    expect(result.findings.some((finding) => finding.state === "vendor_parity_unsupported")).toBe(true);
  });

  it("blocks a cost comparison without cost receipts and an aligned boundary", () => {
    const publication = validPublication();
    publication.claims.push({
      ...parityClaim(),
      id: "cost-comparison",
      claimClass: "cost_comparison",
      text: "The GARPA build is cheaper.",
      scope: { accountingBoundaryComplete: false },
      supportRefs: [],
    });
    const result = runPublicationGate(publication, expectedDigests);
    expect(result.passed).toBe(false);
    expect(result.findings.some((finding) => finding.state === "cost_boundary_misaligned")).toBe(true);
  });

  it("blocks a public release when the safety review permits controlled release only", () => {
    const publication = validPublication();
    publication.safetyReview.state = "controlled_release_only";
    const result = runPublicationGate(publication, expectedDigests);
    expect(result.passed).toBe(false);
    expect(result.findings.some((finding) => finding.state === "safety_review_blocked")).toBe(true);
  });

  it("blocks a claim when required redaction removes its evidence", () => {
    const publication = validPublication();
    publication.redactions.push({
      id: "redaction-block",
      claimId: "mission-evaluation",
      reason: "restricted_source",
      removedContentDescription: "The only evaluation receipt.",
      evidentiaryEffect: "blocks_claim",
      decidedBy: "reviewer",
      decidedAt: "2026-08-23T06:20:00Z",
    });
    const result = runPublicationGate(publication, expectedDigests);
    expect(result.passed).toBe(false);
    expect(result.blockedClaimIds).toContain("mission-evaluation");
    expect(result.findings.some((finding) => finding.state === "redaction_invalidates_claim")).toBe(true);
  });
});
