import type { Ledger, Report } from "../types/audit";
import { renderReportMarkdown } from "./renderReport";

// All exports run locally in the browser — no backend, no network.
function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportReportMarkdown(report: Report): void {
  download("report.md", renderReportMarkdown(report), "text/markdown");
}

export function exportReportJson(report: Report): void {
  // Strip nothing structural, but the JSON is the full machine-readable report.
  download("report.json", JSON.stringify(report, null, 2), "application/json");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// source-ledger.csv: one row per claim, joined to its sources.
export function exportSourceLedgerCsv(ledger: Ledger): void {
  const header = [
    "claim_id",
    "field",
    "statement",
    "evidence_class",
    "confidence",
    "source_titles",
    "source_urls",
    "notes",
  ];
  const rows = ledger.claims.map((c) => {
    const sources = c.sourceIds
      .map((id) => ledger.sources.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    return [
      c.id,
      c.field,
      c.statement,
      c.evidenceClass,
      c.confidence != null ? String(c.confidence) : "",
      sources.map((s) => s.title).join(" | "),
      sources.map((s) => s.url ?? "").join(" | "),
      c.notes ?? "",
    ]
      .map(csvEscape)
      .join(",");
  });
  download("source-ledger.csv", [header.join(","), ...rows].join("\n"), "text/csv");
}
