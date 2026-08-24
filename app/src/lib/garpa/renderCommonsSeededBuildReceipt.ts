import type {
  CommonsSeededBuildReceiptRequest,
  CommonsSeededBuildReceiptResult,
} from "../../types/garpaCommonsSeededBuildReceipt";

function bullets(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ["- None."];
}

export function renderCommonsSeededBuildReceiptMarkdown(
  request: CommonsSeededBuildReceiptRequest,
  result: CommonsSeededBuildReceiptResult,
): string {
  const receipt = request.asBuiltReceipt;
  const installed = receipt.installedComponents.map(
    (item) =>
      `${item.componentId}: ${item.exactModelOrVersion}; quantity ${item.quantity}; serial/lot ${
        item.serialOrLotIds.length > 0 ? item.serialOrLotIds.join(", ") : "not recorded"
      }; firmware/runtime ${item.firmwareOrRuntimeVersion ?? "not applicable"}`,
  );
  const findings = result.findings.map(
    (finding) => `${finding.state}: ${finding.reason}`,
  );

  return [
    `# GARPA Commons-Seeded As-Built Receipt`,
    ``,
    `## State`,
    `- Case: ${receipt.caseId}`,
    `- Receipt: ${receipt.receiptId}`,
    `- Gate state: ${result.state}`,
    `- Admitted for target preflight: ${result.passed}`,
    `- Receipt state: ${receipt.state}`,
    `- Qualification transferred: ${receipt.qualificationTransferred}`,
    `- Mission equivalence claimed: ${receipt.missionEquivalenceClaimed}`,
    ``,
    `## Digest custody`,
    `- Seeded build-manifest result: ${result.seededBuildManifestResultDigest}`,
    `- Frozen build manifest: ${result.buildManifestDigest}`,
    `- As-built receipt: ${result.asBuiltReceiptDigest}`,
    ``,
    `## Installed components`,
    ...bullets(installed),
    ``,
    `## Execution custody`,
    `- Assembly steps receipted: ${result.receiptedAssemblyStepIds.length}`,
    `- Calibration items receipted: ${result.receiptedCalibrationPlanIds.length}`,
    `- Executed substitutions: ${result.substitutedComponentIds.length}`,
    `- Actual cost lines: ${receipt.actualCosts.length}`,
    `- Labor receipts: ${receipt.labor.length}`,
    `- Immutable artifacts: ${receipt.artifacts.length}`,
    ``,
    `## Findings`,
    ...bullets(findings),
    ``,
    `## Required actions`,
    ...bullets(result.pullList),
    ``,
    `## Boundary`,
    ...bullets(result.prohibitedTransitions),
    ``,
  ].join("\n");
}
