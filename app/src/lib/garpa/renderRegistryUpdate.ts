import type { RegistryUpdateResult } from "../../types/garpaRegistry";

function bullets(values: string[], empty: string): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : [`- ${empty}`];
}

export function renderRegistryUpdateMarkdown(
  result: RegistryUpdateResult,
): string {
  const { gate, entry } = result;
  if (!gate.passed || !entry) {
    return [
      `# GARPA Registry Update Blocked`,
      ``,
      `- State: ${gate.state}`,
      `- Next release number: ${gate.nextReleaseNumber}`,
      ``,
      `## Findings`,
      ...bullets(
        gate.findings.map(
          (finding) => `${finding.state}: ${finding.reason}`,
        ),
        "No finding supplied.",
      ),
      ``,
      `## Required actions`,
      ...bullets(
        gate.findings.map((finding) => finding.requiredAction),
        "No action supplied.",
      ),
      ``,
    ].join("\n");
  }

  const currentRelease = entry.releases.find(
    (release) => release.releaseId === entry.currentReleaseId,
  );
  const prior = entry.releases.filter((release) => release.state !== "current");

  return [
    `# GARPA Public Registry Update — ${entry.caseId}`,
    ``,
    `## Identity`,
    `- Canonical subject: ${entry.canonicalSubject}`,
    `- Offering: ${entry.offering ?? "Unresolved"}`,
    `- Aliases: ${entry.aliases.join(", ") || "None"}`,
    `- Current state: ${entry.currentState}`,
    `- Disposition: ${entry.currentDisposition ?? "Unresolved"}`,
    ``,
    `## Governing release`,
    `- Release: ${entry.currentReleaseId}`,
    `- Manifest digest: ${entry.currentReleaseDigest}`,
    `- Release number: ${currentRelease?.releaseNumber ?? "Unresolved"}`,
    ``,
    `## Preserved release history`,
    ...bullets(
      prior.map(
        (release) =>
          `${release.releaseId} · R${release.releaseNumber} · ${release.state} · ${release.manifestDigest}`,
      ),
      "No prior release.",
    ),
    ``,
    `## Version lineage`,
    ...bullets(
      entry.versions.map(
        (version) =>
          `${version.versionId} · ${version.exactVersion ?? version.label} · ${version.state}`,
      ),
      "No version record.",
    ),
    ``,
    `## Identity lineage`,
    ...bullets(
      entry.lineage.map(
        (link) =>
          `${link.fromSubject} -> ${link.toSubject} [${link.relation}] · ${link.note}`,
      ),
      "No identity transition.",
    ),
    ``,
    `## Control boundary`,
    `The registry update changes the governing pointer without rewriting prior releases, release digests, aliases, offering versions, or source-backed identity lineage.`,
    ``,
  ].join("\n");
}
