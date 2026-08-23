import { describe, expect, it } from "vitest";
import manifestRaw from "../../examples/garpa-synthetic-observation/release-manifest.json";
import publicationRaw from "../../examples/garpa-synthetic-observation/publication-package.json";
import type {
  ActualReleaseFile,
  GarpaReleaseManifest,
} from "../../app/src/types/garpaRelease";
import type { PublicationPackage } from "../../app/src/types/garpaPublication";
import { runPublicationGate } from "../../app/src/lib/garpa/runPublicationGate";
import {
  validateReleaseManifestShape,
  verifyReleaseManifest,
} from "../../app/src/lib/garpa/verifyReleaseManifest";

const expectedDigests = {
  missionEvaluation: "evaluation:synthetic-observation:v1",
  build: "build:synthetic-observation:v1",
  qualification: "qualification:synthetic-observation:v1",
};

function manifest(): GarpaReleaseManifest {
  return structuredClone(manifestRaw) as unknown as GarpaReleaseManifest;
}

function publication(): PublicationPackage {
  return structuredClone(publicationRaw) as unknown as PublicationPackage;
}

function actualFiles(
  release: GarpaReleaseManifest,
): Record<string, ActualReleaseFile> {
  return Object.fromEntries(
    release.files.map((file) => [
      file.path,
      { sha256: file.sha256, byteLength: file.byteLength },
    ]),
  );
}

describe("GARPA release manifest shape", () => {
  it("accepts the complete synthetic manifest", () => {
    expect(validateReleaseManifestShape(manifest())).toEqual([]);
  });

  it("rejects unsafe paths and duplicate entries", () => {
    const release = manifest();
    release.files.push({
      ...release.files[0]!,
      path: "../release.json",
    });
    release.files.push({ ...release.files[1]! });
    const errors = validateReleaseManifestShape(release);
    expect(errors.join(" ")).toContain("unsafe");
    expect(errors.join(" ")).toContain("repeats path README.md");
  });

  it("requires every public verification surface", () => {
    const release = manifest();
    release.files = release.files.filter(
      (file) => file.path !== "claims/support-graph.json",
    );
    expect(validateReleaseManifestShape(release).join(" ")).toContain(
      "claims/support-graph.json",
    );
  });
});

describe("GARPA release verification", () => {
  it("passes only when publication and every manifested file agree", () => {
    const release = manifest();
    const publicationGate = runPublicationGate(publication(), expectedDigests);
    const result = verifyReleaseManifest({
      manifest: release,
      actualFiles: actualFiles(release),
      publicationGate,
    });
    expect(result.passed).toBe(true);
    expect(result.blockingReasons).toEqual([]);
  });

  it("blocks a release whose public dossier hash changed", () => {
    const release = manifest();
    const files = actualFiles(release);
    files["public-dossier.md"] = {
      ...files["public-dossier.md"]!,
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    };
    const result = verifyReleaseManifest({
      manifest: release,
      actualFiles: files,
      publicationGate: runPublicationGate(publication(), expectedDigests),
    });
    expect(result.passed).toBe(false);
    expect(result.hashMismatches).toContain("public-dossier.md");
  });

  it("blocks unmanifested files", () => {
    const release = manifest();
    const files = actualFiles(release);
    files["secret-extra.txt"] = {
      sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      byteLength: 1,
    };
    const result = verifyReleaseManifest({
      manifest: release,
      actualFiles: files,
      publicationGate: runPublicationGate(publication(), expectedDigests),
    });
    expect(result.passed).toBe(false);
    expect(result.unexpectedFiles).toContain("secret-extra.txt");
  });

  it("blocks an intact archive when the publication gate did not pass", () => {
    const release = manifest();
    const blockedPublication = publication();
    blockedPublication.vendorParityState = "not_attempted";
    blockedPublication.claims.push({
      ...blockedPublication.claims[0]!,
      id: "unsupported-parity",
      claimClass: "vendor_parity",
      text: "The build matches the vendor.",
    });
    const publicationGate = runPublicationGate(
      blockedPublication,
      expectedDigests,
    );
    const result = verifyReleaseManifest({
      manifest: release,
      actualFiles: actualFiles(release),
      publicationGate,
    });
    expect(result.passed).toBe(false);
    expect(result.publicationAdmitted).toBe(false);
    expect(result.blockingReasons).toContain("publication gate did not pass");
  });
});
