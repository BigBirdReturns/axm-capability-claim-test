import type { VendorParityEvaluation } from "../../types/garpaParity";

function bullets(values: string[], empty: string): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : [`- ${empty}`];
}

export function renderVendorParityMarkdown(
  evaluation: VendorParityEvaluation,
): string {
  return [
    `# GARPA Vendor Parity Evaluation — ${evaluation.caseId}`,
    ``,
    `## Disposition`,
    `- Vendor offering: ${evaluation.vendorOffering}`,
    `- Vendor version: ${evaluation.vendorVersion ?? "Unresolved"}`,
    `- Parity state: ${evaluation.state}`,
    `- GARPA build receipt: ${evaluation.garpaBuildReceiptDigest}`,
    `- Qualification contract: ${evaluation.garpaQualificationContractDigest}`,
    ``,
    `## Metric results`,
    ...bullets(
      evaluation.metricResults.map(
        (result) =>
          `${result.label}: ${result.state}. ${result.reason}`,
      ),
      "No same-fixture metric comparison was admitted.",
    ),
    ``,
    `## Supported parity claims`,
    ...bullets(evaluation.supportedParityClaims, "None."),
    ``,
    `## Unsupported parity claims`,
    ...bullets(evaluation.unsupportedParityClaims, "None."),
    ``,
    `## Largest gap`,
    evaluation.largestGap,
    ``,
    `## What would resolve it`,
    evaluation.whatWouldResolveIt,
    ``,
    `## Scope boundary`,
    evaluation.scopeBoundary,
    ``,
    `## Falsification line`,
    evaluation.falsificationLine,
    ``,
  ].join("\n");
}
